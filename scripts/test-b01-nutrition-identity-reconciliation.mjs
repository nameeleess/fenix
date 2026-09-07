import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import {
  dailyMealIdentityKey,
  planPendingTrainingMealReconciliation,
} from '../src/features/nutrition/dailyMealIdentity.ts'

function meal({
  id,
  date,
  role,
  trainingSessionId,
  status = 'pending',
  deletedAt = null,
  createdAt = `2026-09-01T00:00:${id.padStart(2, '0')}Z`,
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

function session({ id, scheduledDate, status = 'pending', deletedAt = null }) {
  return {
    id,
    scheduledDate,
    status,
    deletedAt,
  }
}

function applyPlan(items, sessions) {
  const plan = planPendingTrainingMealReconciliation(items, sessions)
  const byId = new Map(items.map((item) => [item.id, item]))

  for (const action of plan) {
    const item = byId.get(action.mealId)
    assert.ok(item, `Missing meal ${action.mealId}`)

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

const target = '2026-09-08'
const previous = '2026-09-07'

// D01 — Pre A + Pre B must coexist after A moves onto B's date.
{
  const items = [
    meal({ id: 'pre-a', date: previous, role: 'preworkout', trainingSessionId: 'session-a' }),
    meal({ id: 'pre-b', date: target, role: 'preworkout', trainingSessionId: 'session-b' }),
  ]
  const sessions = [
    session({ id: 'session-a', scheduledDate: target }),
    session({ id: 'session-b', scheduledDate: target }),
  ]

  applyPlan(items, sessions)
  assert.deepEqual(active(items).map((item) => item.id).sort(), ['pre-a', 'pre-b'])
  assert.notEqual(
    dailyMealIdentityKey(target, 'preworkout', 'session-a'),
    dailyMealIdentityKey(target, 'preworkout', 'session-b'),
  )
}

// D02 — Post A + Post B must coexist.
{
  const items = [
    meal({ id: 'post-a', date: previous, role: 'postworkout', trainingSessionId: 'session-a' }),
    meal({ id: 'post-b', date: target, role: 'postworkout', trainingSessionId: 'session-b' }),
  ]
  const sessions = [
    session({ id: 'session-a', scheduledDate: target }),
    session({ id: 'session-b', scheduledDate: target }),
  ]

  applyPlan(items, sessions)
  assert.deepEqual(active(items).map((item) => item.id).sort(), ['post-a', 'post-b'])
}

// D03 — Reprogram A over B: Pre/Post for both sessions stay active.
{
  const items = [
    meal({ id: 'pre-a', date: previous, role: 'preworkout', trainingSessionId: 'session-a' }),
    meal({ id: 'post-a', date: previous, role: 'postworkout', trainingSessionId: 'session-a' }),
    meal({ id: 'pre-b', date: target, role: 'preworkout', trainingSessionId: 'session-b' }),
    meal({ id: 'post-b', date: target, role: 'postworkout', trainingSessionId: 'session-b' }),
  ]
  const sessions = [
    session({ id: 'session-a', scheduledDate: target }),
    session({ id: 'session-b', scheduledDate: target }),
  ]

  applyPlan(items, sessions)
  assert.deepEqual(
    active(items).map((item) => item.id).sort(),
    ['post-a', 'post-b', 'pre-a', 'pre-b'],
  )
}

// D04 — Reprogram B over A: symmetric preservation.
{
  const items = [
    meal({ id: 'pre-a', date: target, role: 'preworkout', trainingSessionId: 'session-a' }),
    meal({ id: 'post-a', date: target, role: 'postworkout', trainingSessionId: 'session-a' }),
    meal({ id: 'pre-b', date: previous, role: 'preworkout', trainingSessionId: 'session-b' }),
    meal({ id: 'post-b', date: previous, role: 'postworkout', trainingSessionId: 'session-b' }),
  ]
  const sessions = [
    session({ id: 'session-a', scheduledDate: target }),
    session({ id: 'session-b', scheduledDate: target }),
  ]

  applyPlan(items, sessions)
  assert.deepEqual(
    active(items).map((item) => item.id).sort(),
    ['post-a', 'post-b', 'pre-a', 'pre-b'],
  )
}

// D05 — Exact duplicates already at target deduplicate deterministically.
{
  const items = [
    meal({ id: 'pre-a-2', createdAt: '2026-09-01T00:00:02Z', date: target, role: 'preworkout', trainingSessionId: 'session-a' }),
    meal({ id: 'pre-a-1', createdAt: '2026-09-01T00:00:01Z', date: target, role: 'preworkout', trainingSessionId: 'session-a' }),
  ]
  const sessions = [session({ id: 'session-a', scheduledDate: target })]

  applyPlan(items, sessions)
  assert.deepEqual(active(items).map((item) => item.id), ['pre-a-1'])
}

// D06 — completed/skipped of another session are never touched by A.
{
  const items = [
    meal({ id: 'pre-a', date: previous, role: 'preworkout', trainingSessionId: 'session-a' }),
    meal({ id: 'pre-b-completed', date: target, role: 'preworkout', trainingSessionId: 'session-b', status: 'completed' }),
    meal({ id: 'pre-b-skipped', date: target, role: 'preworkout', trainingSessionId: 'session-b', status: 'skipped' }),
  ]
  const sessions = [
    session({ id: 'session-a', scheduledDate: target }),
    session({ id: 'session-b', scheduledDate: target }),
  ]

  applyPlan(items, sessions)
  assert.equal(items[1].deletedAt, null)
  assert.equal(items[1].status, 'completed')
  assert.equal(items[2].deletedAt, null)
  assert.equal(items[2].status, 'skipped')
}

// D07 — real reconciliation service consumes the shared deterministic plan.
{
  const source = await readFile(
    new URL('../src/features/nutrition/nutritionVNextService.ts', import.meta.url),
    'utf8',
  )

  assert.match(
    source,
    /planPendingTrainingMealReconciliation\(\s*meals,\s*sessions,?\s*\)/s,
    'reconcilePendingTrainingMeals must consume the canonical reconciliation plan',
  )

  const reconciliationStart = source.indexOf('async function reconcilePendingTrainingMeals()')
  const reconciliationEnd = source.indexOf('async function ensureNutritionDayEntity', reconciliationStart)
  const reconciliation = source.slice(reconciliationStart, reconciliationEnd)

  assert.doesNotMatch(
    reconciliation,
    /meal\.date\s*===\s*session\.scheduledDate[\s\S]*continue/,
    'already-at-target meals must not bypass exact-identity deduplication',
  )
  assert.doesNotMatch(
    reconciliation,
    /candidate\.date\s*===\s*session\.scheduledDate[\s\S]*candidate\.role\s*===\s*meal\.role/,
    'reconciliation must not reimplement date+role-only duplicate semantics',
  )
}

console.log('F2-B01 D01-D07 Nutrition Training identity reconciliation: PASS')
