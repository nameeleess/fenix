import assert from 'node:assert/strict'
import fs from 'node:fs'

const core = fs.readFileSync('qa/v2.1/e2e/core.spec.ts', 'utf8')
const visual = fs.readFileSync('qa/v2.1/e2e/visual.spec.ts', 'utf8')
const library = fs.readFileSync('src/features/nutrition/NutritionLibrary.tsx', 'utf8')

assert.doesNotMatch(
  core,
  /getByRole\('heading',\s*\{\s*name:\s*\/Recetas\/i\s*\}\)/,
  'E2E must not require the mobile-hidden Recipes hero heading',
)
assert.match(
  core,
  /getByRole\('button',\s*\{\s*name:\s*\/Nueva receta\/i\s*\}\)\.first\(\)/,
  'E2E Recipes readiness must use the real visible Nueva receta owner CTA',
)
assert.match(
  core,
  /page\.locator\('\.shopping-catalog-header'\)/,
  'E2E Shopping readiness must use the owned shopping catalog surface',
)
assert.match(visual, /tab === 'Recetas'[\s\S]*Nueva receta/, 'visual and E2E Recipes readiness must remain aligned')
assert.match(visual, /tab === 'Compra'[\s\S]*shopping-catalog-header/, 'visual and E2E Shopping readiness must remain aligned')
assert.match(library, />\s*\+ Nueva receta\s*</, 'Nutrition library must expose the Nueva receta CTA')
assert.match(library, /className=\"shopping-catalog-header\"/, 'Nutrition library must expose the shopping catalog owner surface')

console.log('FÉNIX v2.1 E2E surface contract: PASS (Nutrition Recetas/Compra locators aligned with Golden owner surfaces)')
