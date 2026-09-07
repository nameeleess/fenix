import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = await readFile(
  new URL('../src/features/nutrition/nutritionVNextService.ts', import.meta.url),
  'utf8',
)

assert.match(
  source,
  /const nutritionTrainingReconciliationQueue = createKeyedSerialQueue\(\)/,
  'Nutrition Training reconciliation must own one global serial queue',
)
assert.match(
  source,
  /const NUTRITION_TRAINING_RECONCILIATION_KEY = 'global-training-meal-reconciliation'/,
  'Global reconciliation must use one shared key, never the requested date',
)

const start = source.indexOf('async function reconcilePendingTrainingMeals()')
const end = source.indexOf('async function ensureNutritionDayEntity', start)
assert.ok(start >= 0 && end > start, 'Unable to isolate reconcilePendingTrainingMeals')
const reconciliation = source.slice(start, end)

assert.match(
  reconciliation,
  /nutritionTrainingReconciliationQueue\.run\(\s*NUTRITION_TRAINING_RECONCILIATION_KEY,/s,
  'Every reconciliation execution must enter the global queue internally',
)
assert.match(
  reconciliation,
  /db\.transaction\(\s*'rw',\s*db\.plannedWorkoutSessions,\s*db\.dailyMeals,/s,
  'Session snapshot and dailyMeals writes must share one Dexie transaction covering both stores',
)
assert.match(
  reconciliation,
  /const \[sessions, meals\] = await Promise\.all\(\[\s*db\.plannedWorkoutSessions\.toArray\(\),\s*db\.dailyMeals\.toArray\(\),?\s*\]\)/s,
  'Training and meal snapshots must be read inside the protected transaction',
)
assert.match(
  reconciliation,
  /planPendingTrainingMealReconciliation\(\s*meals,\s*sessions,?\s*\)/s,
  'The already-validated canonical identity/dedup planner must remain in use',
)
assert.match(
  reconciliation,
  /if \(changed\) \{\s*publishCommittedMutation\('nutrition'\)\s*\}/s,
  'A real reconciliation change must publish only after the transaction resolves',
)
assert.match(
  reconciliation,
  /if \(reconciliationPlan\.length === 0\) \{\s*return false\s*\}/s,
  'No-op reconciliation must report no persistent changes',
)
assert.doesNotMatch(
  reconciliation,
  /publishCommittedMutation\('nutrition'\)[\s\S]*db\.dailyMeals\.(?:update|add|bulk)/,
  'Reconciliation publication must not precede persistence writes',
)

const callMatches = [...source.matchAll(/\breconcilePendingTrainingMeals\(\)/g)]
// One definition + Day + Week. All external call sites therefore enter the
// globally protected function rather than the planner/write path directly.
assert.equal(callMatches.length, 3, 'Unexpected direct reconciliation call site added')

const daySerializedStart = source.indexOf('async function getNutritionDaySerialized')
const daySerializedEnd = source.indexOf('export async function getNutritionDay', daySerializedStart)
const daySerialized = source.slice(daySerializedStart, daySerializedEnd)
assert.match(daySerialized, /await reconcilePendingTrainingMeals\(\)/, 'Day must enter global reconciliation')

const weekStart = source.indexOf('export async function getNutritionWeekSuggestion')
const weekEnd = source.indexOf('export async function applyNutritionWeek', weekStart)
const week = source.slice(weekStart, weekEnd)
assert.match(week, /await reconcilePendingTrainingMeals\(\)/, 'Week must enter the same global reconciliation')

assert.doesNotMatch(
  source,
  /nutritionTrainingReconciliationQueue\.run\(\s*(?:date|anchorDate)/,
  'Global reconciliation must not be keyed by date/anchorDate',
)

console.log('F2-B01 global reconciliation source invariants: PASS')
