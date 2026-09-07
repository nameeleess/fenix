import assert from 'node:assert/strict'
import fs from 'node:fs'

const source = fs.readFileSync('src/features/nutrition/nutritionVNextService.ts', 'utf8')

function region(name, nextName) {
  const start = source.indexOf(`export async function ${name}`)
  assert.ok(start >= 0, `${name} missing`)
  const end = nextName ? source.indexOf(`\nexport async function ${nextName}`, start + 10) : source.length
  return source.slice(start, end < 0 ? source.length : end)
}

const replaceRegion = region('replaceDailyMealRecipe', 'setDailyMealPortion')
const portionRegion = region('setDailyMealPortion', 'setDailyMealStatus')
const statusRegion = region('setDailyMealStatus', 'addImprovisedMeal')

for (const [label, text, tokens] of [
  ['replace', replaceRegion, ["db.transaction(\n    'rw',\n    db.dailyMeals,\n    db.recipes", 'db.dailyMeals.get(mealId)', 'db.recipes.get(recipeId)', "meal.status !== 'pending'", 'version: meal.version + 1']],
  ['portion', portionRegion, ["db.transaction(\n    'rw',\n    db.dailyMeals,\n    db.recipes", 'db.dailyMeals.get(mealId)', 'db.recipes.get(meal.recipeId)', "meal.status !== 'pending'", 'version: meal.version + 1']],
  ['status', statusRegion, ["db.transaction('rw', db.dailyMeals", 'db.dailyMeals.get(mealId)', 'version: meal.version + 1', 'patch.confirmedCalories = meal.plannedCalories']],
]) {
  for (const token of tokens) assert.ok(text.includes(token), `${label} missing transactional invariant: ${token}`)
  const txEnd = text.indexOf("publishCommittedMutation('nutrition')")
  const reload = text.indexOf('getNutritionDay(')
  assert.ok(txEnd >= 0 && reload > txEnd, `${label} must publish post-commit before reloading view`)
}

class SerialStore {
  constructor(meal) {
    this.meal = structuredClone(meal)
    this.tail = Promise.resolve()
    this.events = []
    this.versions = [meal.version]
  }

  async tx(fn) {
    const previous = this.tail
    let release
    this.tail = new Promise((resolve) => { release = resolve })
    await previous
    try {
      return await fn(this.meal)
    } finally {
      release()
    }
  }

  committed(label) {
    this.events.push(label)
    this.versions.push(this.meal.version)
  }
}

function baseMeal(overrides = {}) {
  return {
    id: 'meal-1',
    date: '2026-09-08',
    role: 'main_meal',
    status: 'pending',
    planningSource: 'weekly',
    deletedAt: null,
    recipeId: 'A',
    sourceRecipeVersion: 1,
    name: 'Recipe A',
    portionMultiplier: 1,
    plannedQuantity: 1,
    plannedUnit: 'ración',
    plannedCalories: 100,
    plannedProtein: 10,
    plannedCarbs: 20,
    plannedFat: 5,
    plannedDataQuality: 'estimated',
    confirmedQuantity: null,
    confirmedUnit: null,
    confirmedCalories: null,
    confirmedProtein: null,
    confirmedCarbs: null,
    confirmedFat: null,
    confirmedDataQuality: 'unknown',
    confirmedAt: null,
    skippedAt: null,
    version: 1,
    ...overrides,
  }
}

const recipes = {
  A: { id: 'A', name: 'Recipe A', version: 1, calories: 100, protein: 10, carbs: 20, fat: 5, deletedAt: null },
  B: { id: 'B', name: 'Recipe B', version: 4, calories: 240, protein: 22, carbs: 32, fat: 8, deletedAt: null },
  C: { id: 'C', name: 'Recipe C', version: 2, calories: 180, protein: 18, carbs: 25, fat: 7, deletedAt: null },
}

function applyRecipeSnapshot(meal, recipe, multiplier = meal.portionMultiplier ?? 1) {
  meal.recipeId = recipe.id
  meal.name = recipe.name
  meal.sourceRecipeVersion = recipe.version
  meal.portionMultiplier = multiplier
  meal.plannedQuantity = multiplier
  meal.plannedCalories = recipe.calories * multiplier
  meal.plannedProtein = recipe.protein * multiplier
  meal.plannedCarbs = recipe.carbs * multiplier
  meal.plannedFat = recipe.fat * multiplier
}

async function replace(store, recipeId, beforeTx = async () => {}) {
  await beforeTx()
  await store.tx(async (meal) => {
    if (meal.deletedAt !== null) throw new Error('missing')
    if (meal.status !== 'pending') throw new Error('not pending')
    const recipe = recipes[recipeId]
    if (!recipe || recipe.deletedAt !== null) throw new Error('recipe')
    applyRecipeSnapshot(meal, recipe)
    meal.planningSource = 'manual'
    meal.version += 1
  })
  store.committed('replace')
}

async function portion(store, multiplier, beforeTx = async () => {}) {
  await beforeTx()
  await store.tx(async (meal) => {
    if (meal.deletedAt !== null) throw new Error('missing')
    if (meal.status !== 'pending') throw new Error('not pending')
    const recipe = recipes[meal.recipeId]
    if (recipe && recipe.deletedAt === null) applyRecipeSnapshot(meal, recipe, multiplier)
    else {
      const old = meal.portionMultiplier || 1
      meal.plannedCalories = (meal.plannedCalories / old) * multiplier
      meal.plannedProtein = (meal.plannedProtein / old) * multiplier
      meal.plannedCarbs = (meal.plannedCarbs / old) * multiplier
      meal.plannedFat = (meal.plannedFat / old) * multiplier
      meal.portionMultiplier = multiplier
      meal.plannedQuantity = multiplier
    }
    meal.version += 1
  })
  store.committed('portion')
}

async function status(store, nextStatus, beforeTx = async () => {}) {
  await beforeTx()
  await store.tx(async (meal) => {
    if (meal.deletedAt !== null) throw new Error('missing')
    meal.status = nextStatus
    if (nextStatus === 'completed') {
      meal.confirmedQuantity = meal.plannedQuantity
      meal.confirmedUnit = meal.plannedUnit
      meal.confirmedCalories = meal.plannedCalories
      meal.confirmedProtein = meal.plannedProtein
      meal.confirmedCarbs = meal.plannedCarbs
      meal.confirmedFat = meal.plannedFat
      meal.confirmedDataQuality = meal.plannedDataQuality
      meal.confirmedAt = 'confirmed'
      meal.skippedAt = null
    } else if (nextStatus === 'skipped') {
      meal.confirmedQuantity = null
      meal.confirmedUnit = null
      meal.confirmedCalories = null
      meal.confirmedProtein = null
      meal.confirmedCarbs = null
      meal.confirmedFat = null
      meal.confirmedDataQuality = 'unknown'
      meal.confirmedAt = null
      meal.skippedAt = 'skipped'
    } else {
      meal.confirmedQuantity = null
      meal.confirmedUnit = null
      meal.confirmedCalories = null
      meal.confirmedProtein = null
      meal.confirmedCarbs = null
      meal.confirmedFat = null
      meal.confirmedDataQuality = 'unknown'
      meal.confirmedAt = null
      meal.skippedAt = null
    }
    meal.version += 1
  })
  store.committed(`status:${nextStatus}`)
}

async function managedReplan(store, recipeId, label, beforeTx = async () => {}) {
  await beforeTx()
  let changed = false
  await store.tx(async (meal) => {
    if (meal.deletedAt !== null || meal.status !== 'pending' || meal.planningSource === 'manual') return
    applyRecipeSnapshot(meal, recipes[recipeId])
    meal.version += 1
    changed = true
  })
  if (changed) store.committed(label)
}

function gate() {
  let release
  const promise = new Promise((resolve) => { release = resolve })
  return { promise, release }
}

function assertMonotonic(store) {
  for (let i = 1; i < store.versions.length; i += 1) {
    assert.ok(store.versions[i] > store.versions[i - 1], `version regression ${store.versions.join(' -> ')}`)
  }
}

// M01 replace starts, complete wins, replace re-reads completed and rejects.
{
  const store = new SerialStore(baseMeal())
  const g = gate()
  const stale = replace(store, 'B', () => g.promise).then(() => 'ok', () => 'reject')
  await status(store, 'completed')
  g.release()
  assert.equal(await stale, 'reject')
  assert.equal(store.meal.recipeId, 'A')
  assert.equal(store.meal.confirmedCalories, 100)
  assert.deepEqual(store.events, ['status:completed'])
}

// M02 replace wins; complete confirms the new recipe snapshot.
{
  const store = new SerialStore(baseMeal())
  await replace(store, 'B')
  await status(store, 'completed')
  assert.equal(store.meal.recipeId, 'B')
  assert.equal(store.meal.confirmedCalories, 240)
  assert.equal(store.meal.confirmedCalories, store.meal.plannedCalories)
  assertMonotonic(store)
}

// M03 portion starts, complete wins, stale portion rejects.
{
  const store = new SerialStore(baseMeal())
  const g = gate()
  const stale = portion(store, 2, () => g.promise).then(() => 'ok', () => 'reject')
  await status(store, 'completed')
  g.release()
  assert.equal(await stale, 'reject')
  assert.equal(store.meal.portionMultiplier, 1)
  assert.equal(store.meal.confirmedCalories, 100)
}

// M04 portion wins; complete copies the new planned facts.
{
  const store = new SerialStore(baseMeal())
  await portion(store, 2)
  await status(store, 'completed')
  assert.equal(store.meal.plannedCalories, 200)
  assert.equal(store.meal.confirmedCalories, 200)
  assertMonotonic(store)
}

// M05 complete starts, weekly apply wins, completion re-reads and confirms new plan.
{
  const store = new SerialStore(baseMeal())
  const g = gate()
  const delayedComplete = status(store, 'completed', () => g.promise)
  await managedReplan(store, 'B', 'apply')
  g.release()
  await delayedComplete
  assert.equal(store.meal.recipeId, 'B')
  assert.equal(store.meal.confirmedCalories, 240)
}

// M06 complete wins; weekly apply preserves confirmed fact without a write/event.
{
  const store = new SerialStore(baseMeal())
  await status(store, 'completed')
  const version = store.meal.version
  await managedReplan(store, 'B', 'apply')
  assert.equal(store.meal.version, version)
  assert.equal(store.meal.recipeId, 'A')
  assert.equal(store.events.includes('apply'), false)
}

// M07 replace <-> appetite, both serial orders remain coherent/manual-safe.
{
  const first = new SerialStore(baseMeal())
  await replace(first, 'B')
  await managedReplan(first, 'C', 'appetite')
  assert.equal(first.meal.recipeId, 'B')
  assert.equal(first.meal.planningSource, 'manual')

  const second = new SerialStore(baseMeal())
  await managedReplan(second, 'C', 'appetite')
  await replace(second, 'B')
  assert.equal(second.meal.recipeId, 'B')
  assert.equal(second.meal.planningSource, 'manual')
  assertMonotonic(second)
}

// M08 portion <-> appetite: later operation uses current plan/version.
{
  const first = new SerialStore(baseMeal())
  await portion(first, 2)
  await managedReplan(first, 'B', 'appetite')
  assert.equal(first.meal.recipeId, 'B')
  assert.equal(first.meal.portionMultiplier, 2)
  assert.equal(first.meal.plannedCalories, 480)

  const second = new SerialStore(baseMeal())
  await managedReplan(second, 'B', 'appetite')
  await portion(second, 2)
  assert.equal(second.meal.recipeId, 'B')
  assert.equal(second.meal.plannedCalories, 480)
  assertMonotonic(second)
}

// M09 skip <-> apply.
{
  const first = new SerialStore(baseMeal())
  await status(first, 'skipped')
  await managedReplan(first, 'B', 'apply')
  assert.equal(first.meal.status, 'skipped')
  assert.equal(first.meal.recipeId, 'A')

  const second = new SerialStore(baseMeal())
  await managedReplan(second, 'B', 'apply')
  await status(second, 'skipped')
  assert.equal(second.meal.status, 'skipped')
  assert.equal(second.meal.recipeId, 'B')
}

// M10 mixed stress: every committed write increments from current version and confirmed/skipped facts resist replans/replaces/portions.
{
  for (let i = 0; i < 200; i += 1) {
    const store = new SerialStore(baseMeal())
    if (i % 2 === 0) await managedReplan(store, 'C', 'appetite')
    if (i % 3 === 0) await portion(store, 1.5)
    if (i % 5 === 0) await replace(store, 'B')
    await status(store, i % 7 === 0 ? 'skipped' : 'completed')
    const snapshot = structuredClone(store.meal)
    await managedReplan(store, 'C', 'apply')
    await replace(store, 'A').catch(() => {})
    await portion(store, 2).catch(() => {})
    assert.equal(store.meal.status, snapshot.status)
    assert.equal(store.meal.recipeId, snapshot.recipeId)
    assert.equal(store.meal.version, snapshot.version)
    if (store.meal.status === 'completed') {
      assert.equal(store.meal.confirmedCalories, snapshot.confirmedCalories)
      assert.equal(store.meal.confirmedCalories, store.meal.plannedCalories)
    }
    assertMonotonic(store)
  }
}

console.log('F2-RC1.1 DailyMeal causality: PASS (M01-M10 + 200 mixed stress cycles)')
