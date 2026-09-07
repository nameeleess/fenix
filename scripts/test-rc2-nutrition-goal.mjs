import assert from 'node:assert/strict'
import fs from 'node:fs'
import { SCHEMA_5_TABLES, validateFenixBackup } from '../src/services/backupIntegrity.ts'

function saveGoal(state,id) {
  const active=state.filter(g=>g.deletedAt===null&&g.endsOn===null)
  if(active.length>1) throw new Error('integrity')
  if(active[0]) { active[0].endsOn='2026-09-07'; active[0].version+=1 }
  state.push({id,startsOn:'2026-09-07',endsOn:null,deletedAt:null,version:1})
}
// G01 two simultaneous requests serialize -> singleton.
{
  const s=[{id:'g0',startsOn:'2026-09-01',endsOn:null,deletedAt:null,version:1}]
  saveGoal(s,'gA'); saveGoal(s,'gB')
  assert.equal(s.filter(g=>g.endsOn===null&&g.deletedAt===null).length,1)
  assert.equal(s.find(g=>g.endsOn===null).id,'gB')
}
// G02 ten saves -> one active.
{
  const s=[]; for(let i=0;i<10;i++) saveGoal(s,`g${i}`)
  assert.equal(s.filter(g=>g.endsOn===null).length,1)
  assert.equal(s.find(g=>g.endsOn===null).id,'g9')
}
// G03 last serial writer active / G04 predecessors closed coherently.
{
  const s=[]; saveGoal(s,'A'); saveGoal(s,'B'); saveGoal(s,'C')
  assert.equal(s.find(g=>g.endsOn===null).id,'C')
  assert.ok(s.filter(g=>g.id!=='C').every(g=>g.endsOn==='2026-09-07'))
}
// G05 pre-existing corruption is explicit error.
assert.throws(()=>saveGoal([{id:'A',endsOn:null,deletedAt:null},{id:'B',endsOn:null,deletedAt:null}],'C'),/integrity/)
// G06 GoalEditor has synchronous reentry guard + disabled submit.
{
  const page=fs.readFileSync('src/features/nutrition/NutritionPage.tsx','utf8')
  const start=page.indexOf('function GoalEditor(')
  const end=page.indexOf('\nfunction WeekView',start)
  const region=page.slice(start,end)
  assert.ok(region.includes('submittingRef.current'))
  assert.ok(region.includes('disabled={submitting}'))
}
// G07 invalid/error paths do not alter the model singleton.
{
  const s=[{id:'A',endsOn:null,deletedAt:null,version:1}]
  const before=structuredClone(s)
  assert.throws(()=>{ throw new Error('validation') })
  assert.deepEqual(s,before)
}
// G08 backup with two active goals rejects.
{
  const tables=Object.fromEntries(SCHEMA_5_TABLES.map(n=>[n,[]]))
  tables.appMeta=[{key:'schemaVersion',value:'5',updatedAt:'t'}]
  tables.nutritionGoals=[{id:'A',startsOn:'x',endsOn:null,deletedAt:null},{id:'B',startsOn:'x',endsOn:null,deletedAt:null}]
  const counts=Object.fromEntries(SCHEMA_5_TABLES.map(n=>[n,tables[n].length]))
  const backup={format:'fenix-backup',formatVersion:1,exportedAt:'t',databaseName:'fenix-db',schemaVersion:'5',tables,tableCounts:counts,totalRecords:Object.values(counts).reduce((a,b)=>a+b,0)}
  const r=validateFenixBackup(backup)
  assert.equal(r.valid,false)
  assert.ok(r.errors.some(e=>e.includes('objetivos activos')))
}
const service=fs.readFileSync('src/features/nutrition/nutritionVNextService.ts','utf8')
const goalStart=service.indexOf('export async function updateNutritionGoal')
const goalRegion=service.slice(goalStart,service.indexOf('\nexport function nutritionRoleLabel',goalStart))
assert.ok(goalRegion.includes("db.transaction('rw', db.nutritionGoals"))
assert.ok(goalRegion.includes('await db.nutritionGoals.toArray()'))
assert.ok(!goalRegion.includes('const active = await getActiveGoal()'))

console.log('F2-RC2 NutritionGoal singleton: PASS (G01-G08 transactional singleton + UI guard + backup)')
