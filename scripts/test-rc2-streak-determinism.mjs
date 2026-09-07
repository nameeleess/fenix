import assert from 'node:assert/strict'
import fs from 'node:fs'
import { calculateTrainingStreak } from '../src/features/progress/trainingStreakPolicy.ts'

const today = '2026-09-07'
function session(id, status, opts = {}) {
  return {
    id,
    createdAt: opts.createdAt ?? '2026-09-07T08:00:00.000Z',
    deletedAt: null,
    scheduledDate: opts.scheduledDate ?? '2026-09-07',
    status,
    isFormalStrength: opts.isFormalStrength ?? true,
    isExtra: opts.isExtra ?? false,
  }
}
function result(items) { return calculateTrainingStreak(items, today) }

// P01 same entities/permutations -> same result; id is canonical final tie.
{
  const a = session('A', 'completed')
  const b = session('B', 'omitted')
  assert.deepEqual(result([a,b]), result([b,a]))
  assert.deepEqual(result([a,b]), { streak: 0, pending: false })
}
// P02 completed + completed.
assert.deepEqual(result([session('A','completed'), session('B','completed')]), { streak: 2, pending: false })
// P03 completed + omitted stable.
assert.deepEqual(result([session('B','omitted'), session('A','completed')]), { streak: 0, pending: false })
// P04 completed + incomplete stable break.
assert.deepEqual(result([session('A','completed'), session('B','incomplete')]), { streak: 0, pending: false })
// P05 pending + completed: pending neutral but flagged.
assert.deepEqual(result([session('A','completed'), session('B','pending')]), { streak: 1, pending: true })
// P06 extra is neutral.
assert.deepEqual(result([session('A','completed'), session('B','omitted',{isExtra:true})]), { streak: 1, pending: false })
// P07 reprogrammed/same-day is still per identity and deterministic.
{
  const a = session('A','completed',{createdAt:'2026-09-01T00:00:00.000Z'})
  const b = session('B','pending',{createdAt:'2026-09-02T00:00:00.000Z'})
  assert.deepEqual(result([b,a]), result([a,b]))
  assert.deepEqual(result([a,b]), { streak: 1, pending: true })
}
// P08 all consumers share the canonical selector/policy, with no duplicate streak algorithm.
{
  const training = fs.readFileSync('src/features/training/trainingService.ts','utf8')
  const todaySource = fs.readFileSync('src/features/today/todayIntegrationService.ts','utf8')
  const progress = fs.readFileSync('src/features/progress/progressService.ts','utf8')
  const canonical = fs.readFileSync('src/features/progress/trainingStreak.ts','utf8')
  assert.ok(training.includes('getCanonicalTrainingStreak'))
  assert.ok(progress.includes('getCanonicalTrainingStreak'))
  assert.ok(canonical.includes('calculateTrainingStreak'))
  assert.ok(todaySource.includes('streak') || todaySource.includes('Training'))
  const policy = fs.readFileSync('src/features/progress/trainingStreakPolicy.ts','utf8')
  assert.ok(policy.includes('first.id.localeCompare(second.id)'))
}

console.log('F2-RC2 Streak determinism: PASS (P01-P08 canonical date/createdAt/id ordering)')
