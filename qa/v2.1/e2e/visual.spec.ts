import { test, expect, type Page } from '@playwright/test'
import fs from 'node:fs'
const screenContract = JSON.parse(fs.readFileSync('qa/v2.1/golden-screen-contract.json', 'utf8').replace(/^\uFEFF/, '')) as { states: Record<string, { viewport: [number, number] }> }
import { openApp, mainNav, segmented, screenshotState, resetVisualStateChecks, assertVisualStateChecks, seedGoldenVisualFacts, hideRecoveryForGolden04, alignRoutineCatalogForGolden04 } from './helpers'
import { populateGoldenActiveSession } from './activeGoldenFixture'
import { populateGoldenNutrition } from './nutritionGoldenFixture'

const GOLDEN_REFERENCE_TIME = new Date('2026-09-03T07:41:00+02:00')

test.beforeEach(async ({ page }, testInfo) => {
  const index = testInfo.title.match(/@visual (\d{2}) /)?.[1]
  const entry = Object.entries(screenContract.states).find(([name]) => name.startsWith(`${index}_`))
  expect(entry, 'Every Golden needs a pinned screen crop and viewport').toBeTruthy()
  const [width, height] = entry![1].viewport
  await page.setViewportSize({ width, height })
  await page.clock.setFixedTime(GOLDEN_REFERENCE_TIME)
})

async function bootGolden(page: Page) {
  await openApp(page)
  await seedGoldenVisualFacts(page, test.info().title.match(/@visual (\d{2}) /)?.[1])
  await populateGoldenNutrition(page, test.info().title.match(/@visual (\d{2}) /)?.[1])
  await openApp(page)
}

type GoldenFile =
  | '01_HOY_Principal.png'
  | '02_HOY_Dia_0.png'
  | '03_TRAINING_Hoy.png'
  | '04_TRAINING_Rutinas.png'
  | '05_TRAINING_Ejercicios.png'
  | '06_TRAINING_Historial.png'
  | '07_TRAINING_Sesion_en_curso.png'
  | '08_TRAINING_Detalle_rutina.png'
  | '09_TRAINING_Detalle_ejercicio.png'
  | '10_TRAINING_Crear_Editar_rutina.png'
  | '11_TRAINING_Crear_Editar_ejercicio.png'
  | '12_NUTRITION_Hoy.png'
  | '13_NUTRITION_Semana.png'
  | '14_NUTRITION_Recetas.png'
  | '15_NUTRITION_Compra.png'
  | '16_NUTRITION_Detalle_receta.png'
  | '17_NUTRITION_Detalle_comida.png'
  | '18_NUTRITION_Crear_Editar_receta.png'
  | '19_PROGRESO_Resumen.png'
  | '20_PROGRESO_Peso.png'
  | '21_PROGRESO_Rendimiento.png'
  | '22_PROGRESO_Adherencia.png'
  | '23_PROGRESO_Cuerpo_Medidas.png'
  | '24_AJUSTES_Principal.png'
  | '25_AJUSTES_Rutina_diaria.png'
  | '26_AJUSTES_Datos_Backup_Restore.png'

async function capture(page: Page, fileName: GoldenFile) {
  resetVisualStateChecks()
  await screenshotState(page, fileName)
  assertVisualStateChecks()
}

async function bootTraining(page: Page, tab?: 'Rutinas' | 'Ejercicios' | 'Historial') {
  await bootGolden(page)
  await mainNav(page, 'Training')
  if (tab) await segmented(page, 'Secciones de Training', tab)
}

async function assertCanonicalGoldenState(page: Page, state: GoldenFile) {
  // A visual capture is only valid when the fixture identifies the same entity
  // as the Golden. These assertions intentionally fail fast before screenshot.
  if (state === '03_TRAINING_Hoy.png') {
    await expect(page.getByText('Lower B', { exact: true }).first()).toBeVisible()
  }
  if (state === '09_TRAINING_Detalle_ejercicio.png') {
    await expect(page.getByRole('button', { name: /Press banca/i }).first()).toBeVisible()
  }
}

async function bootNutrition(page: Page, tab?: 'Semana' | 'Recetas' | 'Compra') {
  await bootGolden(page)
  await mainNav(page, 'Nutrition')

  if (!tab) {
    await expect(page.locator('.nutrition-vnext-loading')).toHaveCount(0)
    await expect(page.locator('.nutrition-vnext-macros')).toBeVisible()
    return
  }

  await segmented(page, 'Secciones de Nutrition', tab)
  if (tab === 'Semana') await expect(page.locator('.nutrition-vnext-week')).toBeVisible()
  if (tab === 'Recetas') await expect(page.getByRole('button', { name: /Nueva receta/i })).toBeVisible()
  if (tab === 'Compra') await expect(page.locator('.shopping-catalog-header')).toBeVisible()
}

async function bootProgress(page: Page, tab?: 'Peso' | 'Rendimiento' | 'Adherencia' | 'Cuerpo') {
  await bootGolden(page)
  await mainNav(page, 'Progreso')
  if (tab === 'Cuerpo') await page.getByRole('button', { name: /CUERPO.*Medidas/ }).click()
  else if (tab) await segmented(page, 'Secciones de Progreso', tab)
}

async function bootSettings(page: Page) {
  await bootGolden(page)
  await page.getByRole('button', { name: 'Abrir Ajustes' }).first().click()
  await expect(page.getByRole('heading', { name: 'Ajustes', exact: true })).toBeVisible()
}

// One independent browser context per Golden state. A failure in state N must never
// prevent states N+1..26 from running; the full visual sweep reports all failures at once.

test('@visual 01 HOY Principal', async ({ page }) => {
  await bootGolden(page)
  const startDay = page.getByRole('button', { name: 'Iniciar día' })
  if (await startDay.count()) await startDay.click()
  await page.locator('.today-block__header').filter({hasText:'noche'}).click()
  await expect(page.locator('.today-hero__numbers>strong')).toHaveText('4/5')
  await capture(page, '01_HOY_Principal.png')
})

test('@visual 02 HOY Día 0', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2025-09-09T07:41:00+02:00'))
  await bootGolden(page)
  await capture(page, '02_HOY_Dia_0.png')
})

test('@visual 03 TRAINING Hoy', async ({ page }) => {
  await bootTraining(page)
  await assertCanonicalGoldenState(page, '03_TRAINING_Hoy.png')
  await capture(page, '03_TRAINING_Hoy.png')
})

test('@visual 04 TRAINING Rutinas', async ({ page }) => {
  await bootTraining(page, 'Rutinas')
  await hideRecoveryForGolden04(page)
  await alignRoutineCatalogForGolden04(page)
  // Refresh only the Training owner after the QA-only row removal. No app
  // bootstrap is performed here, so the built-in seed cannot restore it.
  await mainNav(page, 'Hoy')
  await mainNav(page, 'Training')
  await segmented(page, 'Secciones de Training', 'Rutinas')
  await capture(page, '04_TRAINING_Rutinas.png')
})

test('@visual 05 TRAINING Ejercicios', async ({ page }) => {
  await bootTraining(page, 'Ejercicios')
  await capture(page, '05_TRAINING_Ejercicios.png')
})

test('@visual 06 TRAINING Historial', async ({ page }) => {
  await bootTraining(page, 'Historial')
  await capture(page, '06_TRAINING_Historial.png')
})

test('@visual 07 TRAINING Sesión en curso', async ({ page }) => {
  await bootTraining(page, 'Rutinas')
  await page.locator('.training-routine-card').filter({ has: page.getByRole('heading', { name: 'Upper B', exact: true }) }).getByRole('button', { name: 'Ver detalle' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Iniciar rutina' }).click()
  await expect(page.getByText(/TRAINING · EN CURSO/)).toBeVisible()
  await populateGoldenActiveSession(page)
  await openApp(page)
  await page.getByRole('navigation', { name:'Navegación principal' }).getByRole('button', { name:'Training',exact:true }).click()
  await expect(page.getByRole('heading',{name:'Upper B',exact:true})).toBeVisible()
  await expect(page.locator('.training-current-card [data-exercise-id]')).toHaveAttribute('data-exercise-id','ex-bench-press')
  await capture(page, '07_TRAINING_Sesion_en_curso.png')
})

test('@visual 08 TRAINING Detalle rutina', async ({ page }) => {
  await bootTraining(page, 'Rutinas')
  await page.locator('.training-routine-card').filter({ has: page.getByRole('heading', { name: 'Upper B', exact: true }) }).getByRole('button', { name: 'Ver detalle' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await capture(page, '08_TRAINING_Detalle_rutina.png')
})

test('@visual 09 TRAINING Detalle ejercicio', async ({ page }) => {
  await bootTraining(page, 'Ejercicios')
  const canonicalExercise = page.getByRole('button', { name: /Press banca/i }).first()
  await expect(canonicalExercise).toBeVisible()
  await canonicalExercise.click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Press banca', exact: true })).toBeVisible()
  await capture(page, '09_TRAINING_Detalle_ejercicio.png')
})

test('@visual 10 TRAINING Crear/Editar rutina', async ({ page }) => {
  await bootTraining(page, 'Rutinas')
  const routine = page.locator('.training-routine-card').filter({ has: page.getByRole('heading', { name: 'Upper A', exact: true }) })
  await routine.getByLabel('Opciones de Upper A').click()
  await routine.getByRole('button', { name: 'Editar', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await capture(page, '10_TRAINING_Crear_Editar_rutina.png')
})

test('@visual 11 TRAINING Crear/Editar ejercicio', async ({ page }) => {
  await bootTraining(page, 'Ejercicios')
  await page.getByRole('button', { name: 'Crear ejercicio' }).first().click()
  await expect(page.getByRole('dialog')).toBeVisible()
  const editor = page.locator('.training-custom-exercise-editor')
  await editor.getByLabel('Nombre', { exact:true }).fill('Press inclinado mancuernas')
  await editor.getByLabel('Músculo principal').fill('Pecho')
  await editor.getByLabel('Secundarios').fill('Deltoides anterior, Tríceps')
  await editor.getByLabel('Equipamiento').fill('Mancuernas')
  await editor.getByLabel('Patrón').selectOption('compound')
  await editor.getByLabel('Técnica / cues').fill('Espalda apoyada en banco inclinado (30–45°).\nControla la fase excéntrica y mantén el pecho activo durante todo el recorrido.')
  await capture(page, '11_TRAINING_Crear_Editar_ejercicio.png')
})

test('@visual 12 NUTRITION Hoy', async ({ page }) => {
  await bootNutrition(page)
  await capture(page, '12_NUTRITION_Hoy.png')
})

test('@visual 13 NUTRITION Semana', async ({ page }) => {
  await bootNutrition(page, 'Semana')
  await capture(page, '13_NUTRITION_Semana.png')
})

test('@visual 14 NUTRITION Recetas', async ({ page }) => {
  await bootNutrition(page, 'Recetas')
  await page.getByRole('button', { name: 'Favoritas', exact:true }).click()
  await expect(page.getByRole('button', { name: /Nueva receta/i })).toBeVisible()
  await capture(page, '14_NUTRITION_Recetas.png')
})

test('@visual 15 NUTRITION Compra', async ({ page }) => {
  await bootNutrition(page, 'Compra')
  await page.getByRole('button', { name: /Abrir carrito de compra/ }).click()
  await expect(page.locator('.shopping-list')).toBeVisible()
  await capture(page, '15_NUTRITION_Compra.png')
})

test('@visual 16 NUTRITION Detalle receta', async ({ page }) => {
  await bootNutrition(page, 'Recetas')
  const recipe = page.getByRole('button', { name: 'Abrir Crema de arroz + whey + plátano', exact:true })
  await expect(recipe).toBeVisible()
  await recipe.click()
  await expect(page.getByRole('button', { name: /Recetas/i }).first()).toBeVisible()
  await capture(page, '16_NUTRITION_Detalle_receta.png')
})

test('@visual 17 NUTRITION Detalle comida', async ({ page }) => {
  await bootNutrition(page)
  const mealHead = page.locator('.nutrition-vnext-meal__head').filter({hasText:'Crema de arroz + whey + plátano'})
  await expect(mealHead, 'Golden 17 requires at least one materialized meal').toBeVisible()
  await mealHead.click()
  const openDetail = page.getByRole('button', { name: 'Abrir detalle' }).first()
  await expect(openDetail).toBeVisible()
  await openDetail.click()
  await expect(page.locator('.nutrition-vnext-meal-detail-v21')).toBeVisible()
  await capture(page, '17_NUTRITION_Detalle_comida.png')
})

test('@visual 18 NUTRITION Crear/Editar receta', async ({ page }) => {
  await bootNutrition(page, 'Recetas')
  await page.getByRole('button', { name: 'Abrir Crema de arroz + whey + plátano', exact:true }).click()
  await page.getByText('Gestionar receta', { exact:true }).click()
  await page.getByRole('button', { name: 'Editar', exact:true }).click()
  await expect(page.getByRole('textbox', { name: 'Nombre', exact:true })).toHaveValue('Crema de arroz + whey + plátano')
  await capture(page, '18_NUTRITION_Crear_Editar_receta.png')
})

test('@visual 19 PROGRESO Resumen', async ({ page }) => {
  await bootProgress(page)
  await capture(page, '19_PROGRESO_Resumen.png')
})

test('@visual 20 PROGRESO Peso', async ({ page }) => {
  await bootProgress(page, 'Peso')
  await capture(page, '20_PROGRESO_Peso.png')
})

test('@visual 21 PROGRESO Rendimiento', async ({ page }) => {
  await bootProgress(page, 'Rendimiento')
  const neutralSummary = page.locator('[data-central-exception="CENTRAL-EXCEPTION-G21-PROGRESS-AGGREGATED-PERFORMANCE-01"]')
  await expect(neutralSummary).toHaveCount(2)
  for (const slot of await neutralSummary.all()) {
    await expect(slot).toContainText('Métrica no disponible')
    await expect(slot).not.toContainText(/\d|%/)
  }
  await capture(page, '21_PROGRESO_Rendimiento.png')
})

test('@visual 22 PROGRESO Adherencia', async ({ page }) => {
  await bootProgress(page, 'Adherencia')
  const nutritionMetric = page.locator('[data-central-exception="CENTRAL-EXCEPTION-G22-NUTRITION-ADHERENCE-01"]')
  await expect(nutritionMetric.getByRole('heading', { name: 'Nutrition', exact: true })).toBeVisible()
  await expect(nutritionMetric.getByText('Métrica no disponible', { exact: true })).toBeVisible()
  await expect(nutritionMetric).not.toContainText(/\d|%/)
  await capture(page, '22_PROGRESO_Adherencia.png')
})

test('@visual 23 PROGRESO Cuerpo/Medidas', async ({ page }) => {
  await bootProgress(page, 'Cuerpo')
  await capture(page, '23_PROGRESO_Cuerpo_Medidas.png')
})

test('@visual 24 AJUSTES Principal', async ({ page }) => {
  await bootSettings(page)
  await expect(page.getByRole('navigation', { name: 'Navegación principal' })).toBeVisible()
  await capture(page, '24_AJUSTES_Principal.png')
})

test('@visual 25 AJUSTES Rutina diaria', async ({ page }) => {
  await bootSettings(page)
  await page.getByRole('button', { name: /Rutina diaria/ }).click()
  await expect(page.getByRole('heading', { name: 'Rutina diaria', exact: true })).toBeVisible()
  await capture(page, '25_AJUSTES_Rutina_diaria.png')
})

test('@visual 26 AJUSTES Datos/Backup/Restore', async ({ page }) => {
  await bootSettings(page)
  await page.getByRole('button', { name: /Datos y backup/ }).click()
  await expect(page.getByRole('heading', { name: 'Datos y backup', exact: true })).toBeVisible()
  await capture(page, '26_AJUSTES_Datos_Backup_Restore.png')
})
