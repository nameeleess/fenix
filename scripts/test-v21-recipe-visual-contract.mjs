import assert from 'node:assert/strict'
import fs from 'node:fs'

const component = fs.readFileSync('src/features/nutrition/RecipeVisual.tsx', 'utf8')
const css = fs.readFileSync('src/features/nutrition/recipe-visual.css', 'utf8')
const nutritionPage = fs.readFileSync('src/features/nutrition/NutritionPage.tsx', 'utf8')
const nutritionCss = fs.readFileSync('src/features/nutrition/nutrition-vnext.css', 'utf8')
const nutritionDayCss = fs.readFileSync('src/features/nutrition/nutrition-day.css', 'utf8')
const nutritionLibrary = fs.readFileSync('src/features/nutrition/NutritionLibrary.tsx', 'utf8')

assert.match(component, /import ['"]\.\/recipe-visual\.css['"]/, 'RecipeVisual must own and import its geometry CSS')
assert.match(css, /\.recipe-visual\s*\{[^}]*position:\s*relative;[^}]*overflow:\s*hidden;[^}]*pointer-events:\s*none;/s, 'RecipeVisual root must bound fallback media and stay pointer-transparent')
assert.match(css, /\.recipe-visual__fallback\s*\{[^}]*position:\s*absolute;[^}]*inset:\s*0;/s, 'fallback must be contained by the media frame')
assert.match(css, /\.recipe-visual__fallback svg\s*\{[^}]*width:\s*55%;[^}]*height:\s*auto;/s, 'fallback SVG must never use intrinsic browser dimensions')
assert.match(css, /\.recipe-visual--thumb\s*\{[^}]*width:\s*36px;[^}]*height:\s*36px;/s, 'thumb geometry missing')
assert.match(css, /\.recipe-visual--hero\s*\{[^}]*width:\s*92px;[^}]*height:\s*70px;/s, 'hero geometry missing')
assert.match(css, /\.recipe-visual--card\s*\{[^}]*width:\s*104px;[^}]*height:\s*86px;/s, 'card geometry missing')
assert.match(nutritionDayCss, /\.nutrition-vnext-nextMeal__summary\s*\{[^}]*grid-template-columns:minmax\(0,1\.6fr\) minmax\(0,1fr\)/, 'next-meal owner must reserve media separately from its action row')
assert.ok(!css.includes('.nutrition-vnext-nextMeal--visual'), 'decorative media must not override its host card layout')
assert.match(nutritionDayCss, /\.nutrition-vnext-meal__head\s*\{[^}]*grid-template-columns:\s*24px minmax\(0,1\.45fr\) minmax\(0,1fr\) 43px 10px;/s, 'mobile meal header must own its explicit columns')
assert.match(fs.readFileSync('src/features/nutrition/nutrition-library-card.css', 'utf8'), /\.nutrition-recipe-card__open\s*\{[^}]*grid-template-columns:\s*104px minmax\(0, 1fr\);/s, 'recipe library must bound card media')
assert.match(nutritionCss, /\.nutrition-vnext-week__mealList article\s*\{[^}]*grid-template-columns:\s*110px minmax\(0, 1fr\) auto;/s, 'week rows must reserve their media column')

const usageCount = (nutritionPage.match(/<RecipeVisual\b/g) ?? []).length + (nutritionLibrary.match(/<RecipeVisual\b/g) ?? []).length
assert.equal(usageCount, 7, `expected RecipeVisual usage sweep across current day/week/library/detail owners, found ${usageCount}`)

for (const legacy of ['final-v1.css', 'mobile-density.css', 'render-parity.css', 'visual-polish.css']) {
  assert.ok(!fs.existsSync(`src/styles/${legacy}`), `RecipeVisual closure must not resurrect legacy override layer: ${legacy}`)
}

console.log('FÉNIX v2.1 RecipeVisual ownership: PASS (7 usages · bounded SVG/media · pointer-transparent · Today/Week/Library/detail/editor integration)')
