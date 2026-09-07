import assert from 'node:assert/strict'
import {
  planPendingTrainingMealReconciliation,
} from '../src/features/nutrition/dailyMealIdentity.ts'

function meal({
  id,
  date = '2026-09-08',
  role = 'preworkout',
  trainingSessionId = 'session-a',
  status = 'pending',
  deletedAt = null,
  createdAt = '2026-09-01T00:00:00Z',
}) {
  return {
    id,
    createdAt,
    updatedAt: createdAt,
    deletedAt,
    version: 1,
    date,
    role,
    order: 0,
    status,
    trainingSessionId,
  }
}

function session(id, scheduledDate = '2026-09-08') {
  return {
    id,
    scheduledDate,
    status: 'pending',
    deletedAt: null,
  }
}

function applyRealPlan(items, sessions) {
  const plan = planPendingTrainingMealReconciliation(items, sessions)
  const byId = new Map(items.map((item) => [item.id, item]))
  const acted = new Set()

  for (const action of plan) {
    assert.equal(
      acted.has(action.mealId),
      false,
      `Meal ${action.mealId} must not ping-pong through multiple reconciliation actions`,
    )
    acted.add(action.mealId)

    const item = byId.get(action.mealId)
    assert.ok(item)

    if (action.type === 'soft-delete') {
      item.deletedAt = 'qa-soft-delete'
    } else {
      item.date = action.targetDate
    }
  }

  return plan
}

function active(items) {
  return items.filter((item) => item.deletedAt === null)
}

function activeIds(items) {
  return active(items).map((item) => item.id).sort()
}

const target = '2026-09-08'
const previous = '2026-09-07'

// D05-A — two exact pending Pre identities already at target -> exactly one active.
{
  const items = [
    meal({ id: 'm2', createdAt: '2026-09-01T00:00:02Z' }),
    meal({ id: 'm1', createdAt: '2026-09-01T00:00:01Z' }),
  ]

  const plan = applyRealPlan(items, [session('session-a')])
  assert.deepEqual(activeIds(items), ['m1'])
  assert.equal(plan.filter((action) => action.type === 'soft-delete').length, 1)
}

// D05-B — three exact pending identities -> deterministic one survivor, two soft-deleted.
{
  const items = [
    meal({ id: 'm3', createdAt: '2026-09-01T00:00:03Z' }),
    meal({ id: 'm1', createdAt: '2026-09-01T00:00:01Z' }),
    meal({ id: 'm2', createdAt: '2026-09-01T00:00:02Z' }),
  ]

  const plan = applyRealPlan(items, [session('session-a')])
  assert.deepEqual(activeIds(items), ['m1'])
  assert.equal(plan.filter((action) => action.type === 'soft-delete').length, 2)
}

// D05-C — exact Post identities deduplicate independently.
{
  const items = [
    meal({ id: 'post-1', role: 'postworkout', createdAt: '2026-09-01T00:00:01Z' }),
    meal({ id: 'post-2', role: 'postworkout', createdAt: '2026-09-01T00:00:02Z' }),
  ]

  applyRealPlan(items, [session('session-a')])
  assert.deepEqual(activeIds(items), ['post-1'])
}

// D05-D — distinct sessions remain distinct for both Pre and Post.
{
  const items = [
    meal({ id: 'pre-a', trainingSessionId: 'session-a' }),
    meal({ id: 'pre-b', trainingSessionId: 'session-b' }),
    meal({ id: 'post-a', role: 'postworkout', trainingSessionId: 'session-a' }),
    meal({ id: 'post-b', role: 'postworkout', trainingSessionId: 'session-b' }),
  ]

  applyRealPlan(items, [session('session-a'), session('session-b')])
  assert.deepEqual(activeIds(items), ['post-a', 'post-b', 'pre-a', 'pre-b'])
}

// D05-E — pending deduplication never destroys completed/skipped of same exact identity.
{
  const items = [
    meal({ id: 'pending-2', createdAt: '2026-09-01T00:00:02Z' }),
    meal({ id: 'pending-1', createdAt: '2026-09-01T00:00:01Z' }),
    meal({ id: 'completed', status: 'completed' }),
    meal({ id: 'skipped', status: 'skipped' }),
  ]

  applyRealPlan(items, [session('session-a')])
  assert.deepEqual(activeIds(items), ['completed', 'pending-1', 'skipped'])
  assert.equal(items.find((item) => item.id === 'completed').deletedAt, null)
  assert.equal(items.find((item) => item.id === 'skipped').deletedAt, null)
}

// Anti ping-pong — a loser never gets a later action that can eliminate the survivor.
for (const count of [2, 3]) {
  const items = Array.from({ length: count }, (_, index) =>
    meal({
      id: `ping-${index + 1}`,
      createdAt: `2026-09-01T00:00:0${index + 1}Z`,
    }),
  )

  const plan = applyRealPlan(items, [session('session-a')])
  assert.deepEqual(activeIds(items), ['ping-1'])
  assert.equal(plan.filter((action) => action.type === 'soft-delete').length, count - 1)
  assert.equal(plan.some((action) => action.mealId === 'ping-1' && action.type === 'soft-delete'), false)
}

// Transfer + multiple exact duplicates — one mover + two target duplicates -> exactly one active, never zero/two.
{
  const items = [
    meal({ id: 'moving', date: previous, createdAt: '2026-09-01T00:00:01Z' }),
    meal({ id: 'target-b', date: target, createdAt: '2026-09-01T00:00:02Z' }),
    meal({ id: 'target-c', date: target, createdAt: '2026-09-01T00:00:03Z' }),
  ]

  const plan = applyRealPlan(items, [session('session-a', target)])
  assert.deepEqual(activeIds(items), ['moving'])
  assert.equal(active(items)[0].date, target)
  assert.equal(plan.filter((action) => action.type === 'soft-delete').length, 2)
  assert.equal(plan.filter((action) => action.type === 'move').length, 1)
}

console.log('F2-B01 E01 exact Training dedup + anti ping-pong: PASS (D05-A..E + transfer)')
