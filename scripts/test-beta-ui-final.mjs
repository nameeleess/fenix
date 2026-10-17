// OT-BETA-05: actual Chromium IndexedDB, synthetic data, localhost only.
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { createRequire } from 'node:module'
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright')
const origin = process.env.BETA_TEST_ORIGIN || 'http://127.0.0.1:4179'
assert.match(origin, /^http:\/\/127\.0\.0\.1:\d+$/)
const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true })
const page = await context.newPage()
const errors = []
page.on('pageerror', e => errors.push(e.message))
async function modules() {
  await page.evaluate(async () => { window.qa = {
    ...(await import('/src/db/database.ts')),
    ...(await import('/src/features/training/trainingService.ts')),
    ...(await import('/src/features/training/trainingEditorService.ts')),
    ...(await import('/src/services/backupService.ts')),
  } })
}
try {
  await page.goto(origin)
  await page.getByRole('heading', { name: 'HOME', exact: true }).waitFor()
  const toggle = page.locator('.today-routine-toggle')
  assert.equal(await toggle.getAttribute('aria-expanded'), 'false')
  await toggle.click()
  await page.getByRole('button', { name: 'Iniciar día', exact: true }).click()
  const task = page.locator('.today-current-block .today-task').first()
  await task.getByRole('button', { name: /^Completar / }).click()
  await task.getByRole('button', { name: /^Desmarcar / }).click()
  await task.getByRole('button', { name: /^Completar / }).waitFor()
  await page.getByRole('button', { name: '+ Añadir para hoy', exact: true }).click()
  await page.getByLabel('Nombre de la nueva acción').fill('Borrador sintético conservado')
  await toggle.click(); await toggle.click()
  assert.equal(await page.getByLabel('Nombre de la nueva acción').inputValue(), 'Borrador sintético conservado')
  await page.getByRole('button', { name: 'Añadir', exact: true }).click()
  console.log('PASS DailyRoutine start/toggle/untoggle; collapse preserves unsaved task; save remains available')

  await page.getByRole('button', { name: 'Training', exact: true }).click()
  await page.getByRole('button', { name: 'Ejercicios', exact: true }).click()
  await page.getByRole('button', { name: 'Crear ejercicio propio', exact: true }).click()
  await page.getByLabel('Nombre', { exact: true }).fill('QA ejercicio UI')
  await page.getByLabel('Grupo muscular', { exact: true }).fill('Biceps')
  await page.getByLabel('Equipo', { exact: true }).fill('Mancuernas')
  await page.getByRole('button', { name: 'Guardar ejercicio', exact: true }).click()
  await page.getByRole('button', { name: 'Editar QA ejercicio UI', exact: true }).click()
  await page.getByLabel('Nombre', { exact: true }).fill('QA ejercicio editado')
  await page.getByRole('button', { name: 'Guardar ejercicio', exact: true }).click()
  const exercise = page.locator('.training-catalog-card').filter({ has: page.getByRole('heading', { name: 'QA ejercicio editado', exact: true }) })
  await exercise.locator('summary').click()
  // The existing context editor uses optimistic revisions independently of the
  // definition editor. Explicitly refresh it after editing that definition.
  await exercise.getByRole('button', { name: 'Recargar contexto', exact: true }).click()
  await exercise.getByLabel('Notas personales').fill('Borrador de contexto')
  await exercise.locator('summary').click(); await exercise.locator('summary').click()
  assert.equal(await exercise.getByLabel('Notas personales').inputValue(), 'Borrador de contexto')
  await exercise.getByRole('button', { name: 'Guardar contexto', exact: true }).click()
  await exercise.getByRole('status').filter({ hasText: 'Guardado' }).waitFor()
  // Reduced visual viewport is a geometry simulation, NOT a Safari keyboard test.
  await page.setViewportSize({ width: 320, height: 360 })
  await exercise.getByLabel('Notas personales').focus()
  await exercise.getByRole('button', { name: 'Guardar contexto', exact: true }).scrollIntoViewIfNeeded()
  const action = await exercise.getByRole('button', { name: 'Guardar contexto', exact: true }).boundingBox()
  const nav = await page.locator('.fenix-navigation').boundingBox()
  assert.ok(action.y >= 0 && action.y + action.height <= nav.y)
  await page.setViewportSize({ width: 390, height: 844 })
  console.log('PASS exercise UI create/edit; detail preserves unsaved context; reduced viewport save reachable (keyboard simulation only)')

  await modules()
  await page.evaluate(async () => {
    const q = window.qa
    const exercise = (await q.db.exercises.toArray()).find(e => e.name === 'QA ejercicio editado')
    await q.saveRoutineDefinition('ot05-routine', null, { name: 'QA routine', type: 'upper', description: 'Synthetic UI lifecycle', estimatedDurationMinutes: 10, isFormalStrength: true },
      [{ id: 'ot05-item', version: null, exerciseId: exercise.id, targetSets: 1, minReps: 8, maxReps: 12, targetRirMin: 1, targetRirMax: 3, restSeconds: 30 }], [])
    await q.planWorkout('ot05-plan-a', 'ot05-routine', 1, q.getLocalDateKey())
    await q.planWorkout('ot05-plan-b', 'ot05-routine', 1, q.getLocalDateKey())
  })
  await page.reload(); await page.getByRole('heading', { name: 'HOME', exact: true }).waitFor(); await modules()
  assert.equal(await page.locator('.today-routine-toggle').getAttribute('aria-expanded'), 'false')
  await page.getByRole('button', { name: 'Ver sesión de hoy', exact: true }).click()
  await page.getByRole('button', { name: 'Iniciar QA routine', exact: true }).click()
  let row = page.locator('.training-set-row:not(.is-warmup)').first()
  await row.locator('input').nth(0).fill('12.125'); await row.locator('input').nth(1).fill('8'); await row.locator('input').nth(2).fill('2')
  await row.getByRole('button', { name: 'Guardar', exact: true }).click()
  await page.waitForFunction(async () => (await window.qa.getActiveWorkout()).exercises[0].sets.some(s => s.weight === 12.125))
  await page.reload(); await page.getByRole('heading', { name: 'HOME', exact: true }).waitFor(); await modules()
  await page.getByRole('button', { name: 'Continuar entrenamiento', exact: true }).click()
  row = page.locator('.training-set-row:not(.is-warmup)').first()
  assert.equal(await row.locator('input').nth(0).inputValue(), '12.125')
  await row.getByRole('button', { name: 'Completar serie', exact: true }).click()
  await row.getByRole('button', { name: 'Desmarcar serie', exact: true }).waitFor()
  await page.getByRole('button', { name: 'Finalizar', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Finalizar sesión', exact: true })
  await dialog.getByRole('button', { name: 'Volver a la sesión', exact: true }).click()
  await page.getByRole('button', { name: 'Finalizar', exact: true }).click()
  await dialog.getByRole('button', { name: 'Marcar completada', exact: true }).click()
  await page.getByRole('button', { name: 'Historial', exact: true }).click()
  await page.locator('.training-history-detail summary').click()
  await page.getByText('12.125×8', { exact: true }).waitFor()
  console.log('PASS Home/Training coordinated; UI start/save/reload/continue/complete; finish dialog cancel and confirm; history details')

  await page.getByRole('button', { name: 'Abrir Settings', exact: true }).click()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: /Exportar backup/ }).click()
  const download = await downloadPromise
  const backup = JSON.parse(await fs.readFile(await download.path(), 'utf8'))
  await fs.writeFile('../../outputs/ot05-synthetic-backup.json', JSON.stringify(backup, null, 2))
  assert.equal((await page.evaluate(b => window.qa.validateFenixBackup(b), backup)).valid, true)
  await page.locator('input[type=file]').setInputFiles('../../outputs/ot05-synthetic-backup.json')
  await page.getByText(/Backup validado:/).waitFor()
  const restore = page.getByRole('button', { name: 'Restaurar backup validado', exact: true })
  assert.equal(await restore.isDisabled(), true)
  await page.getByRole('checkbox').check(); await restore.click()
  await page.getByRole('heading', { name: 'HOME', exact: true }).waitFor(); await modules()
  const after = await page.evaluate(async () => Object.fromEntries(await Promise.all(window.qa.db.tables.map(async t => [t.name, await t.toArray()]))))
  for (const [table, rows] of Object.entries(backup.tables)) if (table !== 'appMeta') assert.deepEqual(after[table], rows, table)
  assert.deepEqual(errors, [])
  console.log('PASS UI backup/export/validation/explicit confirmation/restore/reload; all domain tables identical; no page errors')
} finally { await browser.close() }
