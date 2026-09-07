import assert from 'node:assert/strict'
import fs from 'node:fs'
import { SCHEMA_5_TABLES, validateFenixBackup } from '../src/services/backupIntegrity.ts'

function baseBackup(){const tables=Object.fromEntries(SCHEMA_5_TABLES.map(n=>[n,[]]));tables.appMeta=[{key:'schemaVersion',value:'5',updatedAt:'t'}];return recount({format:'fenix-backup',formatVersion:1,exportedAt:'t',databaseName:'fenix-db',schemaVersion:'5',totalRecords:0,tableCounts:{},tables})}
function recount(b){b.tableCounts=Object.fromEntries(SCHEMA_5_TABLES.map(n=>[n,b.tables[n].length]));b.totalRecords=Object.values(b.tableCounts).reduce((a,c)=>a+c,0);return b}
function template(id='tpl',deletedAt=null){return {id,name:'T',deletedAt}}
function exercise(id='ex'){return {id,name:'E',deletedAt:null}}
function planned(status,opts={}){return {id:opts.id??'P',workoutTemplateId:opts.templateId??'tpl',scheduledDate:'2026-09-07',status,executionSessionId:opts.executionSessionId??null,deletedAt:opts.deletedAt??null}}
function session(status,opts={}){return {id:opts.id??'S',workoutTemplateId:opts.templateId??'tpl',plannedWorkoutId:opts.plannedWorkoutId??null,status,deletedAt:opts.deletedAt??null}}
function snapshot(sessionId='S'){return {id:`snap-${sessionId}`,workoutSessionId:sessionId,exerciseId:'ex',sourceTemplateExerciseId:null,deletedAt:null}}
function set(sessionId='S',completed=true){return {id:`set-${sessionId}`,workoutSessionId:sessionId,workoutSessionExerciseId:`snap-${sessionId}`,exerciseId:'ex',setType:'working',order:1,reps:completed?8:null,weight:20,rir:2,completedAt:completed?'t':null,deletedAt:null}}
function linked(status='active',{archiveTemplate=false,withCompletedSet=status!=='active'}={}){const b=baseBackup();b.tables.workoutTemplates=[template('tpl',archiveTemplate?'archived':null)];b.tables.exercises=[exercise()];const pStatus=status==='active'?'in_progress':status; b.tables.plannedWorkoutSessions=[planned(pStatus,{executionSessionId:'S'})];b.tables.workoutSessions=[session(status,{plannedWorkoutId:'P'})];b.tables.workoutSessionExercises=[snapshot()];if(withCompletedSet)b.tables.exerciseSets=[set('S',true)];return recount(b)}
function invalid(b,label){const r=validateFenixBackup(recount(b));assert.equal(r.valid,false,label);return r}

// K01 active execution linked to pending Planned -> reject.
{const b=baseBackup();b.tables.workoutTemplates=[template()];b.tables.plannedWorkoutSessions=[planned('pending')];b.tables.workoutSessions=[session('active',{plannedWorkoutId:'P'})];invalid(b,'K01')}
// K02 in_progress planned with wrong reverse execution id -> reject.
{const b=linked('active');b.tables.plannedWorkoutSessions[0].executionSessionId='OTHER';invalid(b,'K02')}
// K03 completed bidirectional valid -> accept.
assert.equal(validateFenixBackup(linked('completed')).valid,true,'K03')
// K04 incomplete bidirectional valid -> accept.
assert.equal(validateFenixBackup(linked('incomplete')).valid,true,'K04')
// K05 pending Planned with non-deleted linked execution -> reject.
{const b=baseBackup();b.tables.workoutTemplates=[template()];b.tables.plannedWorkoutSessions=[planned('pending')];b.tables.workoutSessions=[session('active',{plannedWorkoutId:'P'})];invalid(b,'K05')}
// K06 pending operational Planned with archived template -> reject.
{const b=baseBackup();b.tables.workoutTemplates=[template('tpl','archived')];b.tables.plannedWorkoutSessions=[planned('pending')];invalid(b,'K06')}
// K07 active execution with archived template -> reject.
{const b=baseBackup();b.tables.workoutTemplates=[template('tpl','archived')];b.tables.workoutSessions=[session('active')];invalid(b,'K07')}
// K08 terminal historical execution may retain archived template when structurally coherent.
assert.equal(validateFenixBackup(linked('completed',{archiveTemplate:true})).valid,true,'K08')
// K09 completed terminal without completed working set -> reject.
{const b=linked('completed',{withCompletedSet:false});invalid(b,'K09')}
// K10 incomplete terminal without completed working set -> reject.
{const b=linked('incomplete',{withCompletedSet:false});invalid(b,'K10')}
// K11 two active NutritionGoals -> reject.
{const b=baseBackup();b.tables.nutritionGoals=[{id:'g1',startsOn:'x',endsOn:null,deletedAt:null},{id:'g2',startsOn:'x',endsOn:null,deletedAt:null}];invalid(b,'K11')}
// K12 official baseline when supplied must remain valid and exactly 759 records.
if(process.argv[2]){const raw=fs.readFileSync(process.argv[2],'utf8');const backup=JSON.parse(raw);const r=validateFenixBackup(backup);assert.equal(r.valid,true,`K12 baseline invalid: ${r.errors.join(' | ')}`);assert.equal(backup.totalRecords,759);console.log('K12 official baseline: PASS (759 records)')}
else console.log('K12 official baseline: deferred to path-based final gate')

console.log('F2-RC2 Backup cross-entity: PASS (K01-K11 + K12 when baseline path supplied)')
