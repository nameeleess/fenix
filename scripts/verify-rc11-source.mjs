import assert from 'node:assert/strict'
import fs from 'node:fs'

const nutrition = fs.readFileSync('src/features/nutrition/nutritionVNextService.ts', 'utf8')
const backup = fs.readFileSync('src/services/backupIntegrity.ts', 'utf8')
const db = fs.readFileSync('src/db/database.ts', 'utf8')

function functionRegion(name, nextName) {
  const start = nutrition.indexOf(`export async function ${name}`)
  assert.ok(start >= 0, `${name} missing`)
  const end = nextName ? nutrition.indexOf(`\nexport async function ${nextName}`, start + 10) : nutrition.length
  return nutrition.slice(start, end < 0 ? nutrition.length : end)
}

const replace = functionRegion('replaceDailyMealRecipe', 'setDailyMealPortion')
const portion = functionRegion('setDailyMealPortion', 'setDailyMealStatus')
const status = functionRegion('setDailyMealStatus', 'addImprovisedMeal')

for (const [name, region, required] of [
  ['replace', replace, ["db.transaction(\n    'rw',\n    db.dailyMeals,\n    db.recipes", 'db.dailyMeals.get(mealId)', 'db.recipes.get(recipeId)', "meal.status !== 'pending'", 'version: meal.version + 1']],
  ['portion', portion, ["db.transaction(\n    'rw',\n    db.dailyMeals,\n    db.recipes", 'db.dailyMeals.get(mealId)', 'db.recipes.get(meal.recipeId)', "meal.status !== 'pending'", 'version: meal.version + 1']],
  ['status', status, ["db.transaction('rw', db.dailyMeals", 'db.dailyMeals.get(mealId)', 'patch.confirmedCalories = meal.plannedCalories', 'version: meal.version + 1']],
]) {
  for (const token of required) assert.ok(region.includes(token), `${name} missing ${token}`)
  const publish = region.indexOf("publishCommittedMutation('nutrition')")
  const reload = region.indexOf('getNutritionDay(')
  assert.ok(publish >= 0 && reload > publish, `${name}: publish must happen after transaction and before reload`)
}

for (const token of [
  'validatePendingTrainingMealLifecycle',
  "session.status === 'omitted'",
  'meal.date !== session.scheduledDate',
  'validateActiveExerciseSetOrderUniqueness',
  '`${snapshotId}|${setType}|${String(order)}`',
  'validatePendingTrainingMealLifecycle(errors, dailyMeals, plannedMap)',
  'validateActiveExerciseSetOrderUniqueness(errors, exerciseSets)',
]) assert.ok(backup.includes(token), `backup hardening missing ${token}`)

assert.ok(db.includes('version(5)'), 'schema 5 missing')
assert.ok(!db.includes('version(6)'), 'schema 6 forbidden')

console.log('F2-RC1.1 source invariants: PASS (DailyMeal causal mutations + backup Training/order hardening + schema5)')
