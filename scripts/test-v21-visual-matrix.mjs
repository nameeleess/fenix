import assert from 'node:assert/strict'
import fs from 'node:fs'

const visual = fs.readFileSync('qa/v2.1/e2e/visual.spec.ts', 'utf8')
const helpers = fs.readFileSync('qa/v2.1/e2e/helpers.ts', 'utf8')
const training = fs.readFileSync('src/features/training/TrainingPage.tsx', 'utf8')
const nutrition = fs.readFileSync('src/features/nutrition/NutritionPage.tsx', 'utf8')
const library = fs.readFileSync('src/features/nutrition/NutritionLibrary.tsx', 'utf8')
const progress = fs.readFileSync('src/features/progress/ProgressPage.tsx', 'utf8')
const settings = fs.readFileSync('src/features/settings/SettingsPage.tsx', 'utf8')
const designSystem = fs.readFileSync('src/components/designSystem.tsx', 'utf8')

const expected = [
  '01_HOY_Principal.png','02_HOY_Dia_0.png','03_TRAINING_Hoy.png','04_TRAINING_Rutinas.png',
  '05_TRAINING_Ejercicios.png','06_TRAINING_Historial.png','07_TRAINING_Sesion_en_curso.png','08_TRAINING_Detalle_rutina.png',
  '09_TRAINING_Detalle_ejercicio.png','10_TRAINING_Crear_Editar_rutina.png','11_TRAINING_Crear_Editar_ejercicio.png',
  '12_NUTRITION_Hoy.png','13_NUTRITION_Semana.png','14_NUTRITION_Recetas.png','15_NUTRITION_Compra.png',
  '16_NUTRITION_Detalle_receta.png','17_NUTRITION_Detalle_comida.png','18_NUTRITION_Crear_Editar_receta.png',
  '19_PROGRESO_Resumen.png','20_PROGRESO_Peso.png','21_PROGRESO_Rendimiento.png','22_PROGRESO_Adherencia.png',
  '23_PROGRESO_Cuerpo_Medidas.png','24_AJUSTES_Principal.png','25_AJUSTES_Rutina_diaria.png','26_AJUSTES_Datos_Backup_Restore.png',
]

const declaredTests = [...visual.matchAll(/test\('@visual\s+([^']+)'/g)].map((match) => match[1])
assert.equal(declaredTests.length, 26, `visual matrix must declare 26 independent @visual tests, found ${declaredTests.length}`)
assert.equal(new Set(declaredTests).size, 26, 'visual matrix test names must be unique')

const captures = [...visual.matchAll(/capture\(page,\s*'([^']+\.png)'\)/g)].map((match) => match[1])
assert.equal(captures.length, 26, `visual matrix must capture exactly 26 Goldens, found ${captures.length}`)
assert.deepEqual([...captures].sort(), [...expected].sort(), 'visual matrix screenshot names must match the exact 26-Golden contract')
assert.equal(new Set(captures).size, 26, 'each Golden screenshot must be captured exactly once')

assert.ok(!visual.includes('26 Golden contract states are reachable'), 'legacy monolithic 26-state test must remain removed')
assert.ok(!visual.includes("name: 'Crear receta' }).first()"), 'recipe-list CTA must not assume the editor heading label')
assert.match(visual, /Abrir Crema de arroz \+ whey \+ plátano/, 'Golden 18 must navigate through the canonical recipe identity')

const golden18 = visual.slice(visual.indexOf("test('@visual 18"), visual.indexOf("test('@visual 19"))
assert.match(golden18, /bootNutrition\(page, 'Recetas'\)/, 'Golden 18 must start from a clean Recetas state')
assert.match(golden18, /Abrir Crema de arroz \+ whey \+ plátano/, 'Golden 18 must use the canonical populated recipe')
assert.ok(!/Nueva receta/.test(golden18), 'Golden 18 must edit the populated canonical recipe without creating a new domain record')

assert.match(helpers, /toHaveAttribute\('aria-current', 'page'\)/, 'navigation helpers must wait for committed segmented/main state')
assert.match(visual, /resetVisualStateChecks\(\)[\s\S]*screenshotState\(page, fileName\)[\s\S]*assertVisualStateChecks\(\)/, 'each independent Golden capture must retain overflow validation')

const sourceContracts = [
  [training, ['Ver detalle', 'Crear rutina', 'Crear ejercicio', 'Iniciar rutina', 'TRAINING · EN CURSO', 'training-catalog-card--button']],
  [nutrition, ['nutrition-vnext-meal__head', 'Abrir detalle', "label: 'Semana'", "label: 'Recetas'", "label: 'Compra'", 'nutrition-vnext-meal-detail-v21']],
  [library, ['nutrition-recipe-card__open', '+ Nueva receta', '← Recetas', "'Crear receta'"]],
  [progress, ["label: 'Peso'", "label: 'Rendimiento'", "label: 'Adherencia'", "eyebrow=\"CUERPO\""]],
  [settings, ['Rutina diaria', 'Datos y backup', 'Volver a Ajustes']],
  [designSystem, ['Abrir Ajustes']],
]
for (const [source, tokens] of sourceContracts) {
  for (const token of tokens) assert.ok(source.includes(token), `visual locator/source contract missing: ${token}`)
}

console.log('FÉNIX v2.1 visual matrix: PASS (26 independent states · exact screenshots · isolated flows · locator/source contracts · committed navigation)')
