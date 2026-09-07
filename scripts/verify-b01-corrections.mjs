import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'

async function text(path) {
  return readFile(new URL(path, import.meta.url), 'utf8')
}

async function sha(path) {
  const data = await readFile(new URL(path, import.meta.url))
  return createHash('sha256').update(data).digest('hex')
}

const [
  database,
  freshnessHook,
  training,
  nutrition,
  progress,
  todayPage,
  todayService,
  mealIdentity,
] = await Promise.all([
  text('../src/db/database.ts'),
  text('../src/app/useAppFreshness.ts'),
  text('../src/features/training/trainingService.ts'),
  text('../src/features/nutrition/nutritionVNextService.ts'),
  text('../src/features/progress/progressService.ts'),
  text('../src/features/today/TodayPage.tsx'),
  text('../src/features/today/todayService.ts'),
  text('../src/features/nutrition/dailyMealIdentity.ts'),
])

assert.match(database, /CURRENT_SCHEMA_VERSION = 5/, 'Schema must remain 5')
assert.doesNotMatch(database, /&\[date\+role\]/, 'Global unique date+role index is forbidden')

assert.match(freshnessHook, /subscribeToCommittedMutations/, 'App freshness must subscribe to committed mutations')
assert.match(training, /publishCommittedMutation\('training'\)/, 'Training must publish post-commit invalidation')
assert.match(nutrition, /publishCommittedMutation\('nutrition'\)/, 'Nutrition must publish post-commit invalidation')
assert.match(progress, /publishCommittedMutation\('progress'\)/, 'Progress must publish post-commit invalidation')
assert.match(todayService, /publishCommittedMutation\('today'\)/, 'Today mutations feeding Progress must publish invalidation')

assert.match(nutrition, /db\.transaction\(\s*'rw',[\s\S]*?db\.dailyMeals[\s\S]*?async \(\) =>/, 'dailyMeals materialization must use a write transaction')
assert.match(nutrition, /dailyMealMatchesIdentity/, 'Nutrition must use canonical structural identity')
assert.match(nutrition, /trainingSessionId:\s*spec\.trainingSessionId|meal\.trainingSessionId === session\.id/, 'Training meal identity must retain trainingSessionId per session')
assert.match(nutrition, /nutritionDayReadQueue\.run/, 'Concurrent same-day reads must serialize')

assert.match(todayPage, /createLatestWinsGate/, 'Today must use a latest-wins gate')
assert.match(todayPage, /reconcileDailyRoutineForLoad/, 'Today load must use guarded persistence reconciliation')
assert.match(todayPage, /isCurrent/, 'Today must pass a causal current-request guard')
assert.match(todayService, /assertPersistenceCurrent\(canPersist\)/, 'Persistence writes must be guarded, not just React state')
assert.match(todayService, /StaleRoutineReconciliationError/, 'Stale persistence must abort transaction safely')


assert.match(
  mealIdentity,
  /planPendingTrainingMealReconciliation/,
  'Canonical Nutrition identity module must own deterministic Training reconciliation planning',
)
assert.match(
  mealIdentity,
  /dailyMealIdentityKey\(\s*targetDate,\s*meal\.role,\s*meal\.trainingSessionId,?\s*\)/s,
  'Training reconciliation groups must use canonical date+role+trainingSessionId identity',
)
assert.match(
  mealIdentity,
  /a\.createdAt\.localeCompare\(b\.createdAt\)/,
  'Exact Training duplicates must use deterministic stable survivor ordering',
)
assert.match(
  nutrition,
  /planPendingTrainingMealReconciliation\(\s*meals,\s*sessions,?\s*\)/s,
  'Training meal reconciliation must consume the shared deterministic plan',
)
const reconciliationStart = nutrition.indexOf('async function reconcilePendingTrainingMeals()')
const reconciliationEnd = nutrition.indexOf('async function ensureNutritionDayEntity', reconciliationStart)
const reconciliationSource = nutrition.slice(reconciliationStart, reconciliationEnd)
assert.doesNotMatch(
  reconciliationSource,
  /meal\.date\s*===\s*session\.scheduledDate[\s\S]*continue/,
  'Already-at-target Training meals must not bypass exact-identity deduplication',
)
assert.doesNotMatch(
  reconciliationSource,
  /candidate\.date\s*===\s*session\.scheduledDate[\s\S]*candidate\.role\s*===\s*meal\.role/,
  'Training reconciliation must not use date+role-only duplicate semantics',
)

assert.match(
  todayService,
  /await db\s*\.dailyRoutineTasks\s*\.bulkPut\(changedTasks\)[\s\S]*?assertPersistenceCurrent\(canPersist\)/,
  'Today bulkPut must have a causal guard after the awaited write',
)
assert.match(
  todayService,
  /await db\s*\.dailyRoutines\s*\.add\(routine\)[\s\S]*?assertPersistenceCurrent\(canPersist\)[\s\S]*?if \(tasks\.length > 0\)/,
  'Today routine add must have a post-write guard before the optional task path',
)
assert.match(
  todayService,
  /await db\s*\.dailyRoutineTasks\s*\.bulkAdd\(tasks\)[\s\S]*?assertPersistenceCurrent\(canPersist\)/,
  'Today bulkAdd must have a causal guard after the awaited write',
)
assert.match(
  todayService,
  /Last synchronous causal check before the transaction callback exits[\s\S]*?assertPersistenceCurrent\(canPersist\)/,
  'Today creation transaction must end behind a synchronous causal guard',
)

const immutableFiles = new Map([
  ['../src/db/database.ts', 'efff63a6c4f1f641ee9283d10d4dabaedabd269ff15515592b688ec6a580e677'],
  ['../src/features/training/trainingSeed.ts', 'e04a978ef83ef15bc384477d5195a6f60e0c6535ff2ec7be35c7946c2ca423f2'],
  ['../src/features/nutrition/nutritionSeed.ts', '55af4cda81b0a94479f8ab6a2aedafa0bd5f22100a2a0b5c3f377447524373e1'],
  ['../src/features/today/todaySeed.ts', '5fdb46e76a6c1b1d0af4a7ee1e0a085bd1139a3fcc793ee11d481240713c5a9d'],
  ['../src/features/progress/progressSeed.ts', 'aa084e6359d8a454823d4db6e2dbb61b8adc2aa5bcd3fc36bb561d39f653476f'],
  ['../src/services/vNextMigrationService.ts', '47319a288ec4ad8599fd020e4f05278185e5ac9543f55d13604f99b5ce648098'],
  ['../package.json', 'b5e126924ee9c88d9d0231f6c41e99615be29eee23682882f92047b823aa7b16'],
  ['../package-lock.json', '18360bc1f5fd6acd41979236267f4b84fb67d8fc7b0661733b1957dca1e86f2a'],
])

for (const [path, expected] of immutableFiles) {
  assert.equal(await sha(path), expected, `${path} must remain byte-identical to b01.1`)
}

console.log('F2-B01 correction source invariants: PASS')
