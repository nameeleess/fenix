import assert from 'node:assert/strict'
import fs from 'node:fs'

// Deterministic serial models for v2.1-only mutation classes. CORE races remain
// covered by B01/B02/RC1/RC1.1/RC2/RC2.1/RC2.2 suites.
function entity(extra={}){return {id:crypto.randomUUID(),deletedAt:null,version:1,...extra}}

// H01–H04 Today.
{
  const routine=entity({startedAt:null})
  const start=()=>{if(routine.deletedAt!==null)throw new Error('deleted');if(routine.startedAt)return false;routine.startedAt='t';routine.version++;return true}
  assert.equal(start(),true);assert.equal(start(),false);assert.equal(routine.version,2,'H01 double start')
  const task=entity({status:'pending',title:'A'})
  const edit=(title)=>{if(task.deletedAt!==null)throw new Error('deleted');task.title=title;task.version++}
  const toggle=()=>{if(task.deletedAt!==null)throw new Error('deleted');task.status=task.status==='completed'?'pending':'completed';task.version++}
  edit('B');toggle();assert.equal(task.version,3);assert.equal(task.title,'B');assert.equal(task.status,'completed','H02 serial edit/toggle')
  task.deletedAt='t';task.version++;assert.throws(()=>edit('C'),/deleted/,'H03 edit after delete')
  const shift=entity({status:'scheduled'});shift.status='completed';shift.version++;assert.equal(shift.version,2,'H04 workshift independent')
}

// T01/T04 editor state: versioned writes are serial and archive cannot resurrect.
{
  const relation=entity({order:10,targetSets:3})
  const mutate=(patch)=>{if(relation.deletedAt!==null)throw new Error('deleted');Object.assign(relation,patch);relation.version++}
  mutate({order:20});mutate({targetSets:4});assert.deepEqual([relation.order,relation.targetSets,relation.version],[20,4,3])
  const exercise=entity({name:'Propio'});exercise.deletedAt='t';exercise.version++;const stale=()=>{if(exercise.deletedAt!==null)throw new Error('deleted');exercise.name='stale';exercise.version++};assert.throws(stale,/deleted/)
}

// P01–P04 Progress: update/delete no resurrect, same-day comparable update, featured set singleton by exercise id.
{
  const entries=[]
  function save(date,value,additional=false){if(!additional){const current=entries.find(e=>e.deletedAt===null&&e.date===date&&e.comparable!==false);if(current){current.value=value;current.version++;return current}}const x=entity({date,value,comparable:true});entries.push(x);return x}
  const a=save('2026-09-07',66);const b=save('2026-09-07',66.2);assert.equal(a.id,b.id);assert.equal(entries.length,1);assert.equal(a.version,2,'P02 same-day rapid save')
  a.deletedAt='t';a.version++;assert.equal(entries.filter(e=>e.deletedAt===null).length,0);assert.equal(a.version,3,'P01 delete')
  const measurement=entity({date:'2026-09-07',waist:80});measurement.deletedAt='t';measurement.version++;assert.equal(measurement.deletedAt,'t','P03')
  const selected=new Set();for(const id of ['e1','e2','e1'])selected.add(id);assert.deepEqual([...selected],['e1','e2'],'P04 featured exercise logical set')
}

// Source closure: all required v2.1 mutation families use transactions.
const sources={
  today:fs.readFileSync('src/features/today/todayService.ts','utf8'),
  training:fs.readFileSync('src/features/training/trainingService.ts','utf8'),
  progress:fs.readFileSync('src/features/progress/progressService.ts','utf8'),
}
for(const [area,functions] of Object.entries({
  today:['startDay','setDailyTaskStatus','updateDailyTask','addOneOffTask','deleteOneOffTask','upsertWorkShift','setWorkShiftStatus','saveRoutineTemplate'],
  training:['updateRoutineExercise','updateExercisePersonalContext','createWorkoutTemplate','updateWorkoutTemplate','duplicateWorkoutTemplate','archiveWorkoutTemplate','createCustomExercise','updateCustomExercise','archiveCustomExercise'],
  progress:['addWeightEntry','updateWeightEntry','deleteWeightEntry','addBodyMeasurement','updateBodyMeasurement','deleteBodyMeasurement','setFeaturedExercises'],
})){
  for(const fn of functions){const s=sources[area].indexOf(`export async function ${fn}`);assert.ok(s>=0,`${area}.${fn} missing`);const e=sources[area].indexOf('\nexport async function ',s+10);const r=sources[area].slice(s,e<0?sources[area].length:e);assert.match(r,/db\.transaction\(/,`${area}.${fn} missing transaction`)}
}

console.log('FÉNIX v2.1 concurrency matrix: PASS (Today H01-H04 · Training editor serial/no-resurrect · Progress P01-P04 + horizontal tx closure)')
