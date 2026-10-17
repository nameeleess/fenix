// Focal RV-05/06 tests: actual Dexie/IndexedDB, synthetic isolated contexts only.
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const origin = process.env.BETA_TEST_ORIGIN || 'http://127.0.0.1:4177'
assert.match(origin, /^http:\/\/127\.0\.0\.1:\d+$/)
const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
const page = await context.newPage()
async function modules() {
  await page.evaluate(async () => {
    window.qa = { ...(await import('/src/db/database.ts')),
      ...(await import('/src/services/trainingVNextMigration.ts')),
      ...(await import('/src/services/backupService.ts')) }
  })
}
async function state() {
  return page.evaluate(async () => Object.fromEntries(await Promise.all(window.qa.db.tables.map(async t => [t.name, await t.toArray()]))))
}
async function exportUI() {
  const pending = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Exportar copia completa de recuperación' }).click()
  const download = await pending
  return { name: download.suggestedFilename(), backup: JSON.parse(await fs.readFile(await download.path(), 'utf8')) }
}
try {
  await page.goto(origin)
  await page.getByRole('heading', { name: 'HOME', exact: true }).waitFor()
  await modules()
  // Build independent sessions from the application's own seeded definitions.
  await page.evaluate(async () => {
    const db = window.qa.db, now = '2020-01-01T12:00:00.000Z'
    const base = id => ({ id, createdAt: now, updatedAt: now, deletedAt: null, version: 1 })
    const template = await db.workoutTemplates.toCollection().first()
    const exercise = await db.exercises.toCollection().first()
    const session = id => ({ ...base(id), workoutTemplateId: template.id, templateName: template.name, status: 'completed', plannedWorkoutId: null, startedAt: now, completedAt: now, endedAt: now, notes: null })
    const set = (id, sessionId, order) => ({ ...base(id), workoutSessionId: sessionId, workoutSessionExerciseId: null, exerciseId: exercise.id, exerciseName: exercise.name, order, setType: 'working', weight: 12.125, reps: 8, rir: 2, completedAt: now })
    await db.appMeta.delete('trainingVNextMigrationVersion')
    // Sorted first: this compatible session writes a snapshot before the later
    // ambiguous session throws, exercising actual rollback of partial writes.
    await db.workoutSessions.add(session('000-compatible'))
    await db.exerciseSets.add(set('000-set', '000-compatible', 1))
    await db.workoutSessions.add(session('zzz-ambiguous'))
    // Two independent occurrences with all identifying links lost. Equal order
    // is deliberately ambiguous; differing order must not be treated as proof.
    await db.exerciseSets.bulkAdd([set('repeat-a', 'zzz-ambiguous', 1), set('repeat-b', 'zzz-ambiguous', 1)])
  })
  const before = await state()
  const error = await page.evaluate(async () => { try { await window.qa.ensureTrainingVNextMigration(); return null } catch (e) { return e.message } })
  assert.match(error, /RV-05/)
  assert.deepEqual(await state(), before, 'Complete transaction rollback including earlier session')
  console.log('PASS RV-05: two unlinked occurrences rejected; complete 26-table equality after earlier compatible-session writes rolled back')
  // Non-overlapping order numbers are not a historical occurrence identity either.
  await page.evaluate(() => window.qa.db.exerciseSets.update('repeat-b', { order: 2 }))
  const disjointBefore = await state()
  assert.match(await page.evaluate(async () => { try { await window.qa.ensureTrainingVNextMigration(); return '' } catch(e) { return e.message } }), /RV-05/)
  assert.deepEqual(await state(), disjointBefore)
  await page.reload()
  await page.getByRole('alert').filter({ hasText: 'incompatibilidad con datos históricos' }).waitFor()
  await modules()
  assert.deepEqual(await state(), disjointBefore, 'No seeds/meta writes on failed boot')
  const preservation = await exportUI()
  await page.getByRole('status').filter({ hasText: 'NO es un backup restaurable validado' }).waitFor()
  assert.match(preservation.name, /NO-VALIDADA/)
  assert.deepEqual(preservation.backup.tables, disjointBefore, 'All original data exported verbatim')
  assert.equal(Object.keys(preservation.backup.tables).length, 26)
  assert.deepEqual(await state(), disjointBefore, 'Export must not write or rerun migrations')
  const validation = await page.evaluate(b => window.qa.validateFenixBackup(b), preservation.backup)
  assert.equal(validation.valid, false, 'Missing historical links must not bypass restore validator')
  const rejected = await page.evaluate(async b => { try { await window.qa.restoreFenixBackup(b); return false } catch { return true } }, preservation.backup)
  assert.equal(rejected, true)
  assert.deepEqual(await state(), disjointBefore)
  await page.screenshot({ path: '../../outputs/rv0506-recovery-unvalidated.png', fullPage: true })
  console.log('PASS RV-06: failed boot exposes complete unchanged export; invalid historical backup clearly labelled and restore rejected')
  await fs.writeFile('../../outputs/rv0506-preservation-fixture.json', JSON.stringify(preservation.backup, null, 2))
  let incompleteDownloads = 0
  const countDownload = () => { incompleteDownloads++ }
  page.on('download', countDownload)
  await page.evaluate(() => {
    const table = window.qa.db.table('exerciseSets')
    window.qa.originalRead = table.toArray
    table.toArray = async () => { throw new Error('Fallo sintético de lectura de tabla') }
  })
  await page.getByRole('button', { name: 'Exportar copia completa de recuperación' }).click()
  await page.getByRole('status').filter({ hasText: 'Exportación bloqueada' }).waitFor()
  assert.equal(incompleteDownloads, 0, 'No partial file can be downloaded')
  page.off('download', countDownload)
  await page.evaluate(() => { window.qa.db.table('exerciseSets').toArray = window.qa.originalRead })
  assert.deepEqual(await state(), disjointBefore)
  console.log('PASS RV-06: unreadable table blocks export; no partial file downloaded or records changed')
  // Synthetic compatible history: explicit distinct snapshots identify both
  // repeated occurrences. No identity is inferred from names/order/timestamps.
  await page.evaluate(async () => {
    const db = window.qa.db
    for (const [index, id] of ['repeat-a', 'repeat-b'].entries()) {
      const set = await db.exerciseSets.get(id)
      const snapshotId = `historical-snapshot-${index}`
      await db.workoutSessionExercises.add({ id: snapshotId, createdAt: set.createdAt, updatedAt: set.updatedAt, deletedAt: null, version: 1,
        workoutSessionId: set.workoutSessionId, sourceTemplateExerciseId: null, exerciseId: set.exerciseId, exerciseName: set.exerciseName,
        order: index + 1, targetSets: 1, minReps: 8, maxReps: 12, targetRirMin: 1, targetRirMax: 3, restSeconds: 60, substitutedFromExerciseId: null, notes: 'Synthetic original snapshot' })
      await db.exerciseSets.update(id, { workoutSessionExerciseId: snapshotId })
    }
  })
  const compatibleBefore = await state()
  await page.evaluate(() => window.qa.ensureTrainingVNextMigration())
  const compatibleAfter = await state()
  for (const id of ['repeat-a', 'repeat-b']) assert.deepEqual(compatibleAfter.exerciseSets.find(x => x.id === id), compatibleBefore.exerciseSets.find(x => x.id === id))
  for (const row of compatibleBefore.workoutSessionExercises) assert.deepEqual(compatibleAfter.workoutSessionExercises.find(x => x.id === row.id), row)
  await page.reload()
  await page.getByRole('heading', { name: 'HOME', exact: true }).waitFor()
  await modules()
  for (const [button, heading] of [['Training', 'TRAINING'], ['Abrir Settings', 'Settings'], ['Home', 'HOME']]) {
    await page.getByRole('button', { name: button, exact: true }).click()
    await page.getByRole('heading', { name: heading, exact: true }).waitFor()
  }
  console.log('PASS RV-05: existing independent identities unchanged; compatible singleton recovered; normal reopen and Home/Training/Settings accessible')
  // Fault injection only in this browser: initialization failure with valid data
  // demonstrates that export remains independent of the failed migration code.
  const validBefore = await state()
  await page.route('**/src/services/trainingVNextMigration.ts*', route => route.fulfill({ contentType: 'text/javascript', body: 'export async function ensureTrainingVNextMigration(){throw new Error("Compatibilidad histórica: fallo sintético controlado")}' }))
  await page.reload()
  await page.getByRole('alert').waitFor()
  await modules()
  const validExport = await exportUI()
  await page.getByRole('status').filter({ hasText: 'Formato e integridad validados' }).waitFor()
  assert.deepEqual(validExport.backup.tables, validBefore)
  assert.equal((await page.evaluate(b => window.qa.validateFenixBackup(b), validExport.backup)).valid, true)
  assert.deepEqual(await state(), validBefore)
  await page.screenshot({ path: '../../outputs/rv0506-recovery-validated.png', fullPage: true })
  await page.evaluate(b => window.qa.restoreFenixBackup(b), validExport.backup)
  assert.deepEqual(await state(), validBefore, 'Validated synthetic backup restores exactly')
  await page.unroute('**/src/services/trainingVNextMigration.ts*')
  await page.reload()
  await page.getByRole('heading', { name: 'HOME', exact: true }).waitFor()
  await page.getByRole('button', { name: 'Abrir Settings', exact: true }).click()
  await page.locator('input[type=file]').setInputFiles({ name: 'synthetic.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(validExport.backup)) })
  await page.getByText(/Backup validado:/).waitFor()
  assert.equal(await page.getByRole('button', { name: 'Restaurar backup validado' }).isDisabled(), true)
  await page.getByRole('checkbox').check()
  assert.equal(await page.getByRole('button', { name: 'Restaurar backup validado' }).isEnabled(), true)
  await fs.writeFile('../../outputs/rv0506-valid-fixture.json', JSON.stringify(validExport.backup, null, 2))
  console.log('PASS RV-06: injected init failure cannot block export; valid full backup restored identically; normal reopen; Settings explicit restore confirmation retained')
} finally { await browser.close() }
