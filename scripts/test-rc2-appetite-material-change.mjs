import assert from 'node:assert/strict'
import fs from 'node:fs'
import { chooseRecipeForAppetite } from '../src/features/nutrition/nutritionAppetitePolicy.ts'

function recipe(id, calories, opts = {}) {
  return {
    id, createdAt:'t', updatedAt:'t', deletedAt:null, version:1, name:id,
    category:'main_meal', instructions:null, estimatedCalories:calories,
    estimatedProtein:30, estimatedCarbs:50, estimatedFat:opts.fat ?? calories/100,
    isFavorite:false, notes:null, recipeType:'dish', compatibleRoles:opts.roles ?? ['main_meal'],
    volumeClass:opts.volumeClass ?? 'normal', basePortion:1, nutritionDataQuality:'estimated',
  }
}
const legacy = [recipe('A',900),recipe('B',700),recipe('C',500),recipe('D',300)]
function pick(mode, current = null, recipes = legacy, date='2026-09-03') {
  return chooseRecipeForAppetite(recipes,'main_meal',mode,date,'day',current)?.id ?? null
}
function assertChange(fromMode,toMode,recipes=legacy) {
  const current = pick(fromMode,null,recipes)
  const next = pick(toMode,current,recipes)
  assert.ok(current)
  assert.ok(next)
  if (recipes.filter(r => r.deletedAt===null && r.compatibleRoles.includes('main_meal')).length > 1) assert.notEqual(next,current)
}

// A01-A04 material transitions.
assertChange('normal','compact')
assertChange('normal','voluminous')
assertChange('compact','voluminous')
assertChange('voluminous','compact')
// A05 same-mode service path is a stable no-op, not a rotation.
{
  const source = fs.readFileSync('src/features/nutrition/nutritionVNextService.ts','utf8')
  const start = source.indexOf('export async function setNutritionDayAppetite')
  const end = source.indexOf('\nexport async function replaceDailyMealRecipe',start)
  const region = source.slice(start,end)
  assert.ok(region.includes('day && day.appetiteMode === appetiteMode'))
  assert.ok(region.includes('return false'))
  assert.ok(region.includes('keeper?.recipeId ?? null'))
}
// A06 one compatible recipe may remain the same.
{
  const only=[recipe('ONLY',500)]
  assert.equal(pick('compact','ONLY',only),'ONLY')
}
// A07 odd pool must still avoid current when an adequate alternative exists.
{
  const odd=[recipe('A',900),recipe('B',600),recipe('C',300)]
  const current=pick('normal',null,odd)
  assert.notEqual(pick('compact',current,odd),current)
  assert.notEqual(pick('voluminous',current,odd),current)
}
// A08 even pool.
{
  const current=pick('normal')
  assert.notEqual(pick('compact',current),current)
  assert.notEqual(pick('voluminous',current),current)
}
// A09 explicit volume class wins when a distinct explicit candidate exists.
{
  const curated=[
    recipe('CURRENT',800,{volumeClass:'compact'}),
    recipe('ALT',700,{volumeClass:'compact'}),
    recipe('VOL',300,{volumeClass:'voluminous'}),
  ]
  assert.equal(pick('compact','CURRENT',curated),'ALT')
  assert.equal(pick('voluminous','CURRENT',curated),'VOL')
}
// A10 legacy all-normal fallback is deterministic and protected-fact guards remain in service.
{
  const current=pick('normal')
  assert.equal(pick('compact',current),pick('compact',current))
  const service=fs.readFileSync('src/features/nutrition/nutritionVNextService.ts','utf8')
  assert.ok(service.includes("meal.status !== 'pending' || meal.planningSource === 'manual'"))
}

console.log('F2-RC2 Appetite material change: PASS (A01-A10 deterministic alternative selection)')
