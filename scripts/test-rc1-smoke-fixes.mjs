import assert from 'node:assert/strict'
import fs from 'node:fs'
import { chooseRecipeForAppetite } from '../src/features/nutrition/nutritionAppetitePolicy.ts'

function recipe(id, calories, fat, volumeClass = 'normal') {
  return {
    id,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    deletedAt: null,
    version: 1,
    name: id,
    category: 'main_meal',
    instructions: null,
    estimatedCalories: calories,
    estimatedProtein: 30,
    estimatedCarbs: 50,
    estimatedFat: fat,
    isFavorite: false,
    notes: null,
    recipeType: 'dish',
    compatibleRoles: ['main_meal'],
    volumeClass,
    basePortion: 1,
    nutritionDataQuality: 'estimated',
  }
}

// S01 — schema-5 neutral recipes still produce materially different appetite choices.
{
  const recipes = [
    recipe('r100', 100, 2),
    recipe('r200', 200, 4),
    recipe('r300', 300, 6),
    recipe('r400', 400, 8),
    recipe('r500', 500, 10),
    recipe('r600', 600, 12),
  ]
  const compact = chooseRecipeForAppetite(recipes, 'main_meal', 'compact', '2026-09-07')
  const voluminous = chooseRecipeForAppetite(recipes, 'main_meal', 'voluminous', '2026-09-07')
  assert.ok(compact && voluminous)
  assert.ok((compact.estimatedCalories ?? 0) >= 400, 'compact fallback must use energy-dense half')
  assert.ok((voluminous.estimatedCalories ?? Infinity) <= 300, 'voluminous fallback must use lower-energy half')
  assert.notEqual(compact.id, voluminous.id)
}

// S02 — explicit curated volume metadata always wins over fallback heuristics.
{
  const recipes = [
    recipe('neutral-high', 800, 30),
    recipe('explicit-compact', 300, 5, 'compact'),
    recipe('explicit-volume', 900, 40, 'voluminous'),
  ]
  assert.equal(
    chooseRecipeForAppetite(recipes, 'main_meal', 'compact', '2026-09-07')?.id,
    'explicit-compact',
  )
  assert.equal(
    chooseRecipeForAppetite(recipes, 'main_meal', 'voluminous', '2026-09-07')?.id,
    'explicit-volume',
  )
}

const service = fs.readFileSync('src/features/nutrition/nutritionVNextService.ts', 'utf8')
const page = fs.readFileSync('src/features/nutrition/NutritionPage.tsx', 'utf8')
const appCss = fs.readFileSync('src/styles/app.css', 'utf8')

// S03 — appetite write owns day + Training snapshot + recipes + meals atomically.
{
  const start = service.indexOf('export async function setNutritionDayAppetite')
  const end = service.indexOf('\nexport async function replaceDailyMealRecipe', start)
  const region = service.slice(start, end)
  for (const token of [
    'db.nutritionDays',
    'db.plannedWorkoutSessions',
    'db.recipes',
    'db.dailyMeals',
    'chooseRecipeForAppetite',
    "meal.status !== 'pending' || meal.planningSource === 'manual'",
    "publishCommittedMutation('nutrition')",
  ]) assert.ok(region.includes(token), `appetite replan missing ${token}`)
}

// S04 — an explicit recipe replacement becomes user-owned and cannot be overwritten by appetite/week automation.
{
  const start = service.indexOf('export async function replaceDailyMealRecipe')
  const end = service.indexOf('\nexport async function setDailyMealPortion', start)
  const region = service.slice(start, end)
  assert.ok(region.includes("planningSource: 'manual'"))
}

// S05 — opening Week is anchored to the currently viewed Nutrition day, not reset to initial/current date.
assert.ok(page.includes("if (next === 'week')"))
assert.ok(page.includes('setWeekAnchor(date)'))
assert.ok(page.includes('preferredDate={date}'))
assert.ok(page.includes('nutrition-vnext-week__label'))
assert.ok(!page.includes('onCurrent={() =>'))

// S06 — primary module titles and typography share one explicit application-level treatment.
for (const title of ['<h1>NUTRITION</h1>']) assert.ok(page.includes(title))
assert.ok(fs.readFileSync('src/features/training/TrainingPage.tsx','utf8').includes('<h1>TRAINING</h1>'))
assert.ok(fs.readFileSync('src/features/progress/ProgressPage.tsx','utf8').includes('<h1>PROGRESO</h1>'))
for (const token of ['.today-header h1', '.training-main-header h1', '.nutrition-vnext-topbar h1', '.progress-header h1', 'text-transform: uppercase']) {
  assert.ok(appCss.includes(token), `visual coherence missing ${token}`)
}

console.log('F2-RC1 smoke fixes: PASS (appetite replan/week navigation/visual coherence)')
