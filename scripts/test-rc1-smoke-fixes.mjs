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

// S06 — v2.1 supersedes page-local title rules with one shared AppHeader treatment.
const trainingPage = fs.readFileSync('src/features/training/TrainingPage.tsx','utf8')
const progressPage = fs.readFileSync('src/features/progress/ProgressPage.tsx','utf8')
const todayPage = fs.readFileSync('src/features/today/TodayPage.tsx','utf8')
const dsCss = fs.readFileSync('src/styles/design-system.css','utf8')
for (const [source, title] of [[todayPage,'Hoy'], [trainingPage,'Training'], [page,'Nutrition'], [progressPage,'Progreso']]) {
  assert.ok(source.includes('AppHeader'), `${title} missing shared AppHeader`)
  assert.ok(source.includes(`title="${title}"`) || source.includes(`title={'${title}'}`), `${title} AppHeader title missing`)
}
for (const token of ['.ds-app-header h1','--fenix-accent','--fenix-tap:44px']) assert.ok(dsCss.includes(token), `shared visual coherence missing ${token}`)

console.log('F2-RC1 smoke fixes: PASS (appetite replan/week navigation/visual coherence)')
