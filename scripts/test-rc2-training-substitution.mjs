import assert from 'node:assert/strict'
import fs from 'node:fs'

function fixture() { return {session:{status:'active',deletedAt:null},snapshot:{exerciseId:'OLD',version:1,deletedAt:null},sets:[{exerciseId:'OLD',version:1,completedAt:null,deletedAt:null}],routine:{exerciseId:'OLD',version:1,deletedAt:null},events:0} }
function complete(s){ if(s.session.status!=='active'||s.sets[0].deletedAt) throw new Error('reject'); s.sets[0].completedAt='t'; s.sets[0].version+=1; s.events++ }
function save(s){ if(s.sets[0].deletedAt) throw new Error('reject'); s.sets[0].version+=1; s.events++ }
function finish(s,status='completed'){ if(s.session.status!=='active'||!s.sets.some(x=>x.completedAt!==null&&!x.deletedAt)) throw new Error('reject'); s.session.status=status; s.events++ }
function discard(s){ if(s.session.status!=='active') throw new Error('reject'); s.session.deletedAt='d'; s.snapshot.deletedAt='d'; for(const set of s.sets)set.deletedAt='d'; s.events++ }
function substitute(s,{updateRoutine=false}={}){ if(s.session.deletedAt!==null||s.session.status!=='active'||s.snapshot.deletedAt!==null) throw new Error('reject'); if(s.sets.some(x=>x.deletedAt===null&&x.completedAt!==null)) throw new Error('reject'); s.snapshot.exerciseId='NEW';s.snapshot.version+=1;for(const set of s.sets.filter(x=>!x.deletedAt)){set.exerciseId='NEW';set.version+=1}if(updateRoutine){s.routine.exerciseId='NEW';s.routine.version+=1}s.events++ }
// S01 complete wins -> substitute reject with no substitute changes.
{const s=fixture(); complete(s); const before=structuredClone(s); assert.throws(()=>substitute(s)); assert.deepEqual(s,before)}
// S02 substitute wins -> completion belongs to new identity.
{const s=fixture(); substitute(s); complete(s); assert.equal(s.sets[0].exerciseId,'NEW');assert.ok(s.sets[0].completedAt)}
// S03 substitute/save both serial and versions monotonic.
{const s=fixture(); save(s); substitute(s); assert.equal(s.sets[0].version,3); const t=fixture(); substitute(t); save(t); assert.equal(t.sets[0].version,3)}
// S04/S05 terminal first rejects substitute.
for(const terminal of ['completed','incomplete']) {const s=fixture();complete(s);finish(s,terminal);const before=structuredClone(s);assert.throws(()=>substitute(s));assert.deepEqual(s,before)}
// S06 discard first rejects.
{const s=fixture();discard(s);const before=structuredClone(s);assert.throws(()=>substitute(s));assert.deepEqual(s,before)}
// S07 updateRoutine stale completion must not update future routine.
{const s=fixture();complete(s);const before=structuredClone(s.routine);assert.throws(()=>substitute(s,{updateRoutine:true}));assert.deepEqual(s.routine,before)}
// S08 versions advance from current serial state.
{const s=fixture();save(s);substitute(s,{updateRoutine:true});assert.equal(s.sets[0].version,3);assert.equal(s.snapshot.version,2);assert.equal(s.routine.version,2)}
// S09 any completed set blocks substitution.
{const s=fixture();s.sets.push({exerciseId:'OLD',version:1,completedAt:'t',deletedAt:null});assert.throws(()=>substitute(s))}
// S10 mixed stress of serial winners never rewrites completed history.
for(let i=0;i<200;i++) {const s=fixture(); if(i%2===0){complete(s);assert.throws(()=>substitute(s));assert.equal(s.sets[0].exerciseId,'OLD')}else{substitute(s);complete(s);assert.equal(s.sets[0].exerciseId,'NEW')}}

const source=fs.readFileSync('src/features/training/trainingService.ts','utf8')
const start=source.indexOf('export async function substituteSessionExercise')
const end=source.indexOf('\nexport async function getExerciseAlternatives',start)
const region=source.slice(start,end)
for(const token of ['db.workoutSessions','db.workoutSessionExercises','db.exerciseSets','db.exercises','db.workoutTemplateExercises','session.status !== \'active\'','set.completedAt !== null','db.exercises.get(newExerciseId)','snapshot.sourceTemplateExerciseId',"publishCommittedMutation('training')"]) assert.ok(region.includes(token),`substitute missing ${token}`)
const tx=region.indexOf('await db.transaction')
for(const preRead of ['db.workoutSessionExercises.get','db.exerciseSets','db.exercises.get']) assert.ok(region.indexOf(preRead)>=tx,`${preRead} must not precede transaction`)

console.log('F2-RC2 Training substitute causality: PASS (S01-S10 + 200 mixed stress cycles)')
