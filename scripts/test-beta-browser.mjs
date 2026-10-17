// Real Chromium IndexedDB/Dexie integration tests. Run against an isolated Vite
// dev server; PLAYWRIGHT_MODULE can point to externally provided Playwright.
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const origin = process.env.BETA_TEST_ORIGIN || 'http://127.0.0.1:4175'
assert.match(origin, /^http:\/\/127\.0\.0\.1:\d+$/, 'Tests only accept isolated localhost')
const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
const page = await context.newPage()
const errors = []
page.on('pageerror', error => errors.push(error.message))
async function setup(p) {
  await p.goto(origin)
  await p.getByRole('heading', { name: 'HOME', exact: true }).waitFor()
  await p.evaluate(async () => {
    window.qa = {
      ...(await import('/src/db/database.ts')),
      ...(await import('/src/features/training/trainingService.ts')),
      ...(await import('/src/features/training/trainingEditorService.ts')),
      ...(await import('/src/services/trainingVNextMigration.ts')),
      ...(await import('/src/features/today/todayIntegrationService.ts')),
      ...(await import('/src/services/backupService.ts')),
    }
  })
}
try {
  await setup(page)
  console.log('PASS empty database boot, mobile Home')
  const result = await page.evaluate(async () => {
    const q = window.qa, db = q.db
    const check = (v, m) => { if (!v) throw new Error(m) }
    const reject = async fn => { let failed = false; try { await fn() } catch { failed = true } check(failed, 'Expected rejection') }
    const draft = { name: 'QA synthetic', primaryMuscle: 'Biceps', equipment: 'Dumbbell', exerciseType: 'isolation', techniqueNotes: '' }
    await q.saveCustomExercise('custom-exercise-qa', null, draft)
    await q.saveCustomExercise('custom-exercise-qa', 1, { ...draft, name: 'QA edited' })
    await reject(() => q.saveCustomExercise('custom-exercise-qa', 1, draft))
    const routine = { name: 'QA routine', type: 'upper', description: '', estimatedDurationMinutes: 10, isFormalStrength: true }
    const item = { id: 'qa-item', version: null, exerciseId: 'custom-exercise-qa', targetSets: 1, minReps: 8, maxReps: 12, targetRirMin: 1, targetRirMax: 3, restSeconds: 30 }
    await q.saveRoutineDefinition('qa-routine', null, routine, [item], [])
    await q.saveRoutineDefinition('qa-routine', 1, { ...routine, name: 'QA routine edited' }, [{ ...item, version: 1 }, { ...item, id: 'qa-item2' }], [{ id: item.id, version: 1 }])
    await q.saveRoutineDefinition('qa-routine', 2, routine, [{ ...item, id: 'qa-item2', version: 1 }, { ...item, version: 2 }], [{ id: item.id, version: 2 }, { id: 'qa-item2', version: 1 }])
    check((await db.workoutTemplateExercises.get('qa-item2')).order === 1, 'Reorder')
    await q.saveRoutineDefinition('qa-routine', 3, routine, [{ ...item, version: 3 }], [{ id: item.id, version: 3 }, { id: 'qa-item2', version: 2 }])
    await reject(() => q.saveRoutineDefinition('qa-routine', 3, routine, [item], []))
    const today = q.getLocalDateKey()
    await Promise.all([q.planWorkout('qa-plan', 'qa-routine', 4, today), q.planWorkout('qa-plan', 'qa-routine', 4, today)])
    await q.planWorkout('qa-plan2', 'qa-routine', 4, today)
    check((await db.plannedWorkoutSessions.toArray()).filter(x => x.id.startsWith('qa-')).length === 2, 'same day and retry')
    let home = (await q.getTodayIntegrationSummary(today)).training
    check(home.dateRelation === 'today' && home.sessionCount === 2, 'Home today')
    await q.reprogramPlannedWorkout('qa-plan', '2099-01-01', 1)
    await q.reprogramPlannedWorkout('qa-plan2', '2099-01-02', 1)
    check((await q.getTodayIntegrationSummary(today)).training.dateRelation === 'future', 'Home future')
    await q.reprogramPlannedWorkout('qa-plan', '2001-01-01', 2)
    check((await q.getTodayIntegrationSummary(today)).training.dateRelation === 'overdue', 'Home overdue')
    await q.reprogramPlannedWorkout('qa-plan', today, 3)
    await q.startPlannedWorkout('qa-plan')
    const active = await q.getActiveWorkout()
    const set = active.exercises[0].sets.find(x => x.setType === 'working')
    await q.saveSetDraft(set.id, { weight: 10.25, reps: 8, rir: 2 }, set.version)
    const snapshot = await db.workoutSessionExercises.toArray()
    const sessions = await db.workoutSessions.toArray()
    // Synthetic legacy v5 fixture: preserve all execution facts, remove only the
    // new link and snapshot to reproduce an installation not migrated to vNext.
    await db.appMeta.delete('trainingVNextMigrationVersion')
    await db.workoutSessionExercises.delete(active.exercises[0].snapshot.id)
    await db.exerciseSets.update(set.id, { workoutSessionExerciseId: null })
    const before = await db.exerciseSets.get(set.id)
    const foreignTables = db.tables.filter(t => !['appMeta', 'workoutSessionExercises', 'exerciseSets'].includes(t.name))
    const foreignBefore = JSON.stringify(await Promise.all(foreignTables.map(t => t.toArray())))
    check((await q.getActiveWorkout()).exercises.length === 0, 'Legacy bug reproduced')
    await q.ensureTrainingVNextMigration()
    const after = await db.exerciseSets.get(set.id)
    for (const key of Object.keys(before).filter(k => !['workoutSessionExerciseId', 'version', 'updatedAt'].includes(k))) check(JSON.stringify(before[key]) === JSON.stringify(after[key]), 'Legacy field changed: ' + key)
    check(foreignBefore === JSON.stringify(await Promise.all(foreignTables.map(t => t.toArray()))), 'Foreign data changed')
    check((await q.getActiveWorkout()).exercises[0].sets[0].id === set.id, 'Legacy visible')
    const stable = JSON.stringify(await db.exerciseSets.toArray())
    await q.ensureTrainingVNextMigration()
    check(stable === JSON.stringify(await db.exerciseSets.toArray()), 'Migration idempotency')
    // Existing repeated exercise identities must not be collapsed. Ambiguous
    // unlinked history must roll back all writes, including the marker.
    await db.appMeta.delete('trainingVNextMigrationVersion')
    const migrated = await db.workoutSessionExercises.toArray()
    await db.workoutSessionExercises.add({ ...migrated[0], id: 'qa-duplicate-snapshot', order: 2 })
    await q.ensureTrainingVNextMigration()
    check((await db.exerciseSets.get(set.id)).workoutSessionExerciseId === after.workoutSessionExerciseId, 'Explicit identity overwritten')
    await db.appMeta.delete('trainingVNextMigrationVersion')
    await db.exerciseSets.update(set.id, { workoutSessionExerciseId: null })
    await reject(() => q.ensureTrainingVNextMigration())
    check(!(await db.appMeta.get('trainingVNextMigrationVersion')), 'Failed migration marker')
    check((await db.exerciseSets.get(set.id)).workoutSessionExerciseId === null, 'Failed migration rollback')
    // Restore the synthetic fixture's valid links for subsequent lifecycle tests.
    await db.exerciseSets.put(after)
    await db.workoutSessionExercises.delete('qa-duplicate-snapshot')
    await q.ensureTrainingVNextMigration()
    return { setId: set.id, sessionId: active.session.id, legacy: { sessions: sessions.length, originalSnapshots: snapshot.length, preservedSet: after } }
  })
  console.log('PASS actual Dexie: exercise/routine CRUD, order/remove, stale definitions, same-day plans, retry, reprogram, Home dates, legacy preservation/idempotency/rollback', JSON.stringify(result))
  await page.evaluate(async id=>{ const db=window.qa.db,s=await db.exerciseSets.get(id); await db.appMeta.delete('trainingVNextMigrationVersion'); await db.workoutSessionExercises.delete(s.workoutSessionExerciseId); await db.exerciseSets.update(id,{workoutSessionExerciseId:null}) },result.setId)
  await setup(page)
  assert.equal((await page.evaluate(()=>window.qa.getActiveWorkout())).exercises[0].sets[0].id,result.setId)
  console.log('PASS application boot with synthetic legacy v5 (migration called by App)')
  const client2 = await context.newPage()
  await setup(client2)
  const stale = await page.evaluate(id => window.qa.getSetForEditing(id), result.setId)
  await client2.evaluate(async id => { const q=window.qa; const s=await q.getSetForEditing(id); await q.saveSetDraft(id,{weight:11.125,reps:9,rir:1},s.version) }, result.setId)
  const conflict = await page.evaluate(async ({ id, version }) => { try { await window.qa.saveSetDraft(id,{weight:99,reps:9,rir:2},version); return false } catch { return true } }, {id:result.setId,version:stale.version})
  assert.equal(conflict, true)
  const latest = await page.evaluate(id => window.qa.getSetForEditing(id),result.setId)
  assert.equal(latest.weight,11.125)
  await page.getByRole('button',{name:'Training',exact:true}).click()
  const row=page.locator('.training-set-row:not(.is-warmup)').first()
  await row.waitFor()
  await row.locator('input').first().fill('12.375')
  assert.equal(await row.locator('input').first().evaluate(el=>el.validity.stepMismatch),false)
  await client2.evaluate(async id=>{const q=window.qa,s=await q.getSetForEditing(id);await q.saveSetDraft(id,{weight:13.125,reps:10,rir:2},s.version)},result.setId)
  await row.getByRole('button',{name:'Guardar',exact:true}).click()
  await row.getByRole('button',{name:'Descartar borrador y recargar serie'}).click()
  await page.waitForFunction(()=>document.querySelector('.training-set-row:not(.is-warmup) input')?.value==='13.125')
  assert.equal(await row.locator('input').first().inputValue(),'13.125')
  await row.locator('input').first().fill('14.375')
  await row.getByRole('button',{name:'Guardar',exact:true}).dblclick()
  await page.waitForFunction(async id=>(await window.qa.getSetForEditing(id)).weight===14.375,result.setId)
  assert.equal((await page.evaluate(id=>window.qa.getSetForEditing(id),result.setId)).weight,14.375)
  await setup(page)
  assert.equal((await page.evaluate(()=>window.qa.getActiveWorkout())).session.id,result.sessionId)
  assert.equal((await page.evaluate(id=>window.qa.getSetForEditing(id),result.setId)).weight,14.375)
  console.log('PASS two real clients: stale write rejected, UI reload reads persistence, arbitrary load, double click, draft and active execution reload')
  await page.evaluate(async id=>{const q=window.qa,s=await q.getSetForEditing(id);await q.toggleSetCompletion(id,{weight:s.weight,reps:s.reps,rir:s.rir},s.version)},result.setId)
  await page.evaluate(id=>window.qa.finishWorkout(id,'completed'),result.sessionId)
  const history=await page.evaluate(()=>window.qa.getWorkoutHistory())
  const downloadPromise=page.waitForEvent('download')
  await page.evaluate(()=>window.qa.exportFenixBackup())
  const download=await downloadPromise
  const backup=JSON.parse(await fs.readFile(await download.path(),'utf8'))
  await fs.writeFile('../../outputs/synthetic-backup.json',JSON.stringify(backup,null,2))
  const validated=await page.evaluate(b=>window.qa.validateFenixBackup(b),backup)
  assert.equal(validated.valid,true,JSON.stringify(validated))
  await page.evaluate(async b=>{const q=window.qa;const invalid={...b,totalRecords:-1};let rejected=false;try{await q.restoreFenixBackup(invalid)}catch{rejected=true}if(!rejected)throw Error('Invalid backup accepted');await q.restoreFenixBackup(b)},backup)
  await setup(page)
  assert.deepEqual(await page.evaluate(()=>window.qa.getWorkoutHistory()),history)
  const after=await page.evaluate(async()=>Object.fromEntries(await Promise.all(window.qa.db.tables.map(async t=>[t.name,await t.toArray()]))))
  // Boot refreshes only schemaVersion.updatedAt. Every domain row must match.
  for(const [table,rows] of Object.entries(backup.tables)) if(table!=='appMeta') assert.deepEqual(after[table],rows,table)
  console.log('PASS Backup download/validation/reject-invalid/full restore/reload/history; tables=',Object.keys(backup.tables).length)
  for(const [label,name] of [['home','Home'],['training','Training'],['settings','Abrir Settings']]){
    await page.getByRole('button',{name,exact:true}).click()
    await page.getByRole('heading',{name:label==='home'?'HOME':label==='settings'?'Settings':'TRAINING',exact:true}).waitFor()
    await page.screenshot({path:`../../outputs/mobile-${label}.png`,fullPage:true})
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Mobile overflow '+label)
  }
  assert.deepEqual(errors,[])
  console.log('PASS mobile 390x844 Home/Training/Settings, no page errors')
} finally { await browser.close() }
