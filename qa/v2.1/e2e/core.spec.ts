import { test, expect } from '@playwright/test'
import { openApp, mainNav, segmented, readStore } from './helpers'

test('core navigation, dialogs, persistence and double-submit guards', async ({ page, context }) => {
  await openApp(page)

  await expect(page.getByRole('heading', { name: 'Hoy' })).toBeVisible()
  const start = page.getByRole('button', { name: 'Iniciar día' })
  if (await start.count()) {
    await start.dblclick({ delay: 20 })
    await expect(page.getByText('Iniciar el día activa la rutina')).toHaveCount(0)
  }

  await mainNav(page, 'Training')
  await segmented(page, 'Secciones de Training', 'Rutinas')
  await expect(page.getByRole('button', { name: 'Crear rutina' }).first()).toBeVisible()
  await page.getByRole('button', { name: 'Crear rutina' }).first().click()
  const routineDialog = page.getByRole('dialog')
  await expect(routineDialog).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(routineDialog).toHaveCount(0)

  await segmented(page, 'Secciones de Training', 'Ejercicios')
  await expect(page.getByLabel('Buscar ejercicio')).toBeVisible()

  await mainNav(page, 'Nutrition')
  await segmented(page, 'Secciones de Nutrition', 'Recetas')
  await expect(page.getByRole('button', { name: /Nueva receta/i }).first()).toBeVisible()
  await segmented(page, 'Secciones de Nutrition', 'Compra')
  await expect(page.locator('.shopping-catalog-header')).toBeVisible()

  await mainNav(page, 'Progreso')
  for (const tab of ['Resumen', 'Peso', 'Rendimiento', 'Adherencia']) {
    await segmented(page, 'Secciones de Progreso', tab)
  }
  await segmented(page, 'Secciones de Progreso', 'Resumen')
  await page.getByRole('button', { name: /CUERPO.*Medidas/ }).click()
  await expect(page.getByRole('heading', { name: 'Medidas comparables', exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Abrir Ajustes' }).first().click()
  await expect(page.getByRole('heading', { name: 'Ajustes' })).toBeVisible()
  await page.getByRole('button', { name: /Datos y backup/ }).click()
  await expect(page.getByRole('heading', {name:'Datos almacenados localmente'})).toBeVisible()
  expect((await readStore<{key:string;value:string}>(page,'appMeta')).find(row => row.key === 'schemaVersion')?.value).toBe('5')
  await expect(page.locator('input[type="file"][accept="application/json,.json"]')).toBeAttached()

  // Reload must preserve local IndexedDB state and the app shell.
  await page.reload()
  await expect(page.getByRole('navigation', { name: 'Navegación principal' })).toBeVisible()

  // Browser context is isolated from the user's normal profile.
  const dbs = await page.evaluate(async () => (await indexedDB.databases()).map((item) => item.name))
  expect(dbs).toContain('fenix-db')
  expect(context.pages().length).toBeGreaterThanOrEqual(1)
})

test('offline after valid load keeps shell and local data available', async ({ page, context }) => {
  await openApp(page)
  await page.evaluate(async () => {
    if ('serviceWorker' in navigator) await navigator.serviceWorker.ready
  })
  const controlled = await page.evaluate(() => !('serviceWorker' in navigator) || Boolean(navigator.serviceWorker.controller))
  if (!controlled) {
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('navigation', { name: 'Navegación principal' })).toBeVisible()
  }
  await mainNav(page, 'Training')
  await context.setOffline(true)

  // Validate FÉNIX's real offline-event response while the current page is alive.
  // Playwright/Chromium 1.62.x can report navigator.onLine=true for a page born
  // into an already-offline context after reload, so post-reload network emulation
  // is validated by shell/data availability rather than that browser heuristic.
  await expect(page.getByText(/Sin conexión/)).toBeVisible()
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('navigation', { name: 'Navegación principal' })).toBeVisible()
  await mainNav(page, 'Hoy')
  await mainNav(page, 'Nutrition')
  await mainNav(page, 'Progreso')
  await context.setOffline(false)
})

test('Nutrition UI double-submit guards produce one logical fact', async ({ page }) => {
  await openApp(page)
  await mainNav(page, 'Nutrition')

  const manualName = 'E2E doble submit'
  const beforeMeals = await readStore<{ name?: string; planningSource?: string; status?: string; deletedAt?: string | null }>(page, 'dailyMeals')
  const beforeManual = beforeMeals.filter((item) => item.name === manualName && item.planningSource === 'manual' && item.status === 'completed' && item.deletedAt === null).length

  await page.getByRole('button', { name: '+ Improvisada' }).click()
  const improvised = page.getByRole('dialog', { name: 'Comida improvisada' })
  await expect(improvised).toBeVisible()
  await improvised.getByPlaceholder('Ej. Bocadillo de pavo').fill(manualName)
  const saveMeal = improvised.getByRole('button', { name: 'Guardar como realizada' })
  await saveMeal.evaluate((button) => {
    const submit = button as HTMLButtonElement
    const form = submit.form
    if (!form) throw new Error('Improvised meal submit button must belong to a form')
    form.requestSubmit(submit)
    form.requestSubmit(submit)
  })
  await expect(improvised).toHaveCount(0)

  const afterMeals = await readStore<{ name?: string; planningSource?: string; status?: string; deletedAt?: string | null }>(page, 'dailyMeals')
  const afterManual = afterMeals.filter((item) => item.name === manualName && item.planningSource === 'manual' && item.status === 'completed' && item.deletedAt === null).length
  expect(afterManual - beforeManual).toBe(1)

  const beforeGoals = await readStore(page, 'nutritionGoals')
  await page.locator('.nutrition-day-controls>summary').click()
  await page.getByRole('button', { name: 'Objetivos' }).click()
  const goalDialog = page.getByRole('dialog', { name: 'Objetivos Nutrition' })
  await expect(goalDialog).toBeVisible()
  const saveGoal = goalDialog.getByRole('button', { name: 'Guardar objetivo' })
  await saveGoal.evaluate((button) => {
    const submit = button as HTMLButtonElement
    const form = submit.form
    if (!form) throw new Error('Nutrition goal submit button must belong to a form')
    form.requestSubmit(submit)
    form.requestSubmit(submit)
  })
  await expect(goalDialog).toHaveCount(0)
  const afterGoals = await readStore(page, 'nutritionGoals')
  expect(afterGoals.length - beforeGoals.length).toBe(1)
})

