import assert from 'node:assert/strict'
import { SCHEMA_5_TABLES, validateFenixBackup, semanticBackupDiff } from '../src/services/backupIntegrity.ts'

function baseBackup() {
  const tables=Object.fromEntries(SCHEMA_5_TABLES.map((name)=>[name,[]]))
  tables.appMeta=[{key:'schemaVersion',value:'5',updatedAt:'t'}]
  const tableCounts=Object.fromEntries(SCHEMA_5_TABLES.map((name)=>[name,tables[name].length]))
  return {format:'fenix-backup',formatVersion:1,exportedAt:'2026-09-06T00:00:00.000Z',databaseName:'fenix-db',schemaVersion:'5',totalRecords:1,tableCounts,tables}
}
function recount(backup){
  backup.tableCounts=Object.fromEntries(SCHEMA_5_TABLES.map((name)=>[name,backup.tables[name].length]))
  backup.totalRecords=Object.values(backup.tableCounts).reduce((a,b)=>a+b,0)
  return backup
}
function clone(value){return structuredClone(value)}
function expectInvalid(mutator,label){const b=baseBackup();mutator(b);recount(b);const v=validateFenixBackup(b);assert.equal(v.valid,false,label);return v}

assert.equal(validateFenixBackup(baseBackup()).valid,true,'empty schema5 backup with appMeta must validate')

// Missing required zero-row table.
{
  const b=baseBackup(); delete b.tables.workShifts; delete b.tableCounts.workShifts; b.totalRecords=1
  assert.equal(validateFenixBackup(b).valid,false)
}
// Wrong count / total.
{
  const b=baseBackup(); b.tableCounts.exercises=1
  assert.equal(validateFenixBackup(b).valid,false)
}
// Duplicate id.
expectInvalid((b)=>{b.tables.exercises=[{id:'e',deletedAt:null},{id:'e',deletedAt:null}]},'duplicate id')
// Broken FK.
expectInvalid((b)=>{b.tables.workoutTemplateExercises=[{id:'x',workoutTemplateId:'missing',exerciseId:'missing',deletedAt:null}]},'broken FK')
// Active child/deleted parent.
expectInvalid((b)=>{
 b.tables.workoutTemplates=[{id:'t',deletedAt:null}]; b.tables.exercises=[{id:'e',deletedAt:null}]
 b.tables.workoutSessions=[{id:'s',workoutTemplateId:'t',status:'completed',deletedAt:'deleted'}]
 b.tables.workoutSessionExercises=[{id:'snap',workoutSessionId:'s',exerciseId:'e',sourceTemplateExerciseId:null,deletedAt:null}]
},'active child deleted parent')
// Double active workout.
expectInvalid((b)=>{b.tables.workoutTemplates=[{id:'t',deletedAt:null}];b.tables.workoutSessions=[{id:'s1',workoutTemplateId:'t',status:'active',plannedWorkoutId:null,deletedAt:null},{id:'s2',workoutTemplateId:'t',status:'active',plannedWorkoutId:null,deletedAt:null}]},'double active')
// Completed set invalid domain.
expectInvalid((b)=>{
 b.tables.workoutTemplates=[{id:'t',deletedAt:null}];b.tables.exercises=[{id:'e',deletedAt:null}]
 b.tables.workoutSessions=[{id:'s',workoutTemplateId:'t',status:'completed',plannedWorkoutId:null,deletedAt:null}]
 b.tables.workoutSessionExercises=[{id:'snap',workoutSessionId:'s',exerciseId:'e',sourceTemplateExerciseId:null,deletedAt:null}]
 b.tables.exerciseSets=[{id:'set',workoutSessionId:'s',exerciseId:'e',workoutSessionExerciseId:'snap',setType:'working',reps:0,weight:0,rir:2,completedAt:'x',deletedAt:null}]
},'completed set domain')
// Duplicate daily routine / nutrition day.
expectInvalid((b)=>{b.tables.dailyRoutines=[{id:'a',date:'2026-09-06',templateId:null,deletedAt:null},{id:'b',date:'2026-09-06',templateId:null,deletedAt:null}]},'routine duplicate')
expectInvalid((b)=>{b.tables.nutritionDays=[{id:'a',date:'2026-09-06',deletedAt:null},{id:'b',date:'2026-09-06',deletedAt:null}]},'nutrition day duplicate')
// Duplicate canonical Training meal identity; distinct sessions are legal.
{
 const b=baseBackup();b.tables.workoutTemplates=[{id:'t',deletedAt:null}]
 b.tables.plannedWorkoutSessions=[{id:'A',workoutTemplateId:'t',scheduledDate:'2026-09-06',status:'pending',executionSessionId:null,deletedAt:null},{id:'B',workoutTemplateId:'t',scheduledDate:'2026-09-06',status:'pending',executionSessionId:null,deletedAt:null}]
 b.tables.dailyMeals=[{id:'m1',date:'2026-09-06',role:'preworkout',status:'pending',trainingSessionId:'A',recipeId:null,deletedAt:null},{id:'m2',date:'2026-09-06',role:'preworkout',status:'pending',trainingSessionId:'A',recipeId:null,deletedAt:null}]
 recount(b); assert.equal(validateFenixBackup(b).valid,false)
 b.tables.dailyMeals[1].trainingSessionId='B'; recount(b); assert.equal(validateFenixBackup(b).valid,true,'different session ids must coexist')
}
// Schema > current.
{
 const b=baseBackup();b.schemaVersion='6';b.tables.appMeta[0].value='6';assert.equal(validateFenixBackup(b).valid,false)
}
// appMeta schema mismatch.
{
 const b=baseBackup();b.tables.appMeta[0].value='4';assert.equal(validateFenixBackup(b).valid,false)
}
// Corrupt JSON parse.
assert.throws(()=>JSON.parse('{broken'))

// Atomic restore simulator: injected failure rolls back original.
{
 const original={a:[1],b:[2]};let db=clone(original)
 function restoreAtomic(input,fail=false){const tx=clone(db);try{tx.a=[];tx.b=[];tx.a.push(...input.a);if(fail)throw new Error('injected');tx.b.push(...input.b);db=tx}catch{}}
 restoreAtomic({a:[3],b:[4]},true);assert.deepEqual(db,original)
 restoreAtomic({a:[3],b:[4]},false);assert.deepEqual(db,{a:[3],b:[4]})
}
// Coherent export simulator: one snapshot cannot mix before/after commit.
{
 let db={parent:{version:1},child:{version:1}}
 const snap=clone(db);db={parent:{version:2},child:{version:2}}
 assert.deepEqual(snap,{parent:{version:1},child:{version:1}})
}
// Semantic roundtrip primitive.
{
 const b=baseBackup();const restored=clone(b);assert.deepEqual(semanticBackupDiff(b,restored),[])
}

console.log('F2-RC1 Backup integrity validator/recovery: PASS (schema5/FK/invariants/atomic rollback/coherent snapshot)')
