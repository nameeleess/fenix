import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const [database, training, progress, app, today, nutrition, progressPage] = await Promise.all([
  readFile(new URL('../src/db/database.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/features/training/trainingService.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/features/progress/progressService.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/App.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/features/today/TodayPage.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/features/nutrition/NutritionPage.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/features/progress/ProgressPage.tsx', import.meta.url), 'utf8'),
])

assert.match(database, /CURRENT_SCHEMA_VERSION = 5/, 'Schema must remain 5')
assert.doesNotMatch(database, /[&,+\s]streak[,\s']/i, 'No persisted streak index/field may be added')
assert.match(training, /getCanonicalTrainingStreak\(todayKey\)/, 'Training must use canonical streak selector')
assert.doesNotMatch(training, /async function getTrainingStreak\(/, 'Independent Training streak implementation must be removed')
assert.match(progress, /getCanonicalTrainingStreak\(todayKey\)/, 'Progress must use canonical streak selector')
assert.doesNotMatch(progress, /let streak = 0/, 'Independent Progress streak loop must be removed')
assert.match(app, /useAppFreshness\(\)/, 'App must own freshness signal')
assert.match(today, /refreshRevision/, 'Today must consume freshness signal')
assert.match(nutrition, /refreshRevision/, 'Nutrition must consume freshness signal')
assert.match(progressPage, /refreshRevision/, 'Progress must consume freshness signal')
assert.doesNotMatch(app, /window\.location\.reload/, 'Global reload is forbidden')

console.log('F2-B01 source invariants: PASS')
