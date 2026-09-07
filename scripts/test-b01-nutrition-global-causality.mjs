import assert from 'node:assert/strict'
import { createKeyedSerialQueue } from '../src/app/keyedSerialQueue.ts'
import { createFreshnessEventBus } from '../src/app/freshnessEvents.ts'
import { planPendingTrainingMealReconciliation } from '../src/features/nutrition/dailyMealIdentity.ts'

function deferred() {
  let resolve
  const promise = new Promise((done) => { resolve = done })
  return { promise, resolve }
}

function baseSession(id, scheduledDate, status = 'pending') {
  return {
    id,
    scheduledDate,
    status,
    deletedAt: null,
    isFormalStrength: true,
    isExtra: false,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z',
    version: 1,
  }
}

function baseMeal({
  id,
  sessionId,
  date,
  role = 'preworkout',
  status = 'pending',
  deletedAt = null,
  createdAt = '2026-09-01T00:00:00Z',
}) {
  return {
    id,
    trainingSessionId: sessionId,
    date,
    role,
    status,
    deletedAt,
    createdAt,
    updatedAt: createdAt,
    version: 1,
    order: 1,
  }
}

function createHarness({ sessions, meals }) {
  const reconciliationQueue = createKeyedSerialQueue()
  const storeTransactionQueue = createKeyedSerialQueue()
  const bus = createFreshnessEventBus()
  const state = {
    sessions: new Map(sessions.map((item) => [item.id, { ...item }])),
    meals: new Map(meals.map((item) => [item.id, { ...item }])),
  }
  const trace = []
  let activeReconciliations = 0
  let maxActiveReconciliations = 0

  async function withStores(task) {
    return storeTransactionQueue.run('plannedWorkoutSessions+dailyMeals', task)
  }

  async function reprogram(sessionId, scheduledDate) {
    return withStores(async () => {
      const session = state.sessions.get(sessionId)
      assert.ok(session)
      session.scheduledDate = scheduledDate
      session.updatedAt = `reprogram:${scheduledDate}`
      session.version += 1
      trace.push(`training:${sessionId}:${scheduledDate}`)
    }).then((result) => {
      bus.publish('training')
      return result
    })
  }

  async function omit(sessionId) {
    return withStores(async () => {
      const session = state.sessions.get(sessionId)
      assert.ok(session)
      session.status = 'omitted'
      session.version += 1
      trace.push(`training:${sessionId}:omitted`)
    }).then((result) => {
      bus.publish('training')
      return result
    })
  }

  async function reconcile(route, hooks = {}) {
    return reconciliationQueue.run('global-training-meal-reconciliation', async () => {
      activeReconciliations += 1
      maxActiveReconciliations = Math.max(maxActiveReconciliations, activeReconciliations)
      trace.push(`reconcile:${route}:start`)

      try {
        const changed = await withStores(async () => {
          const sessionSnapshot = [...state.sessions.values()].map((item) => ({ ...item }))
          const mealSnapshot = [...state.meals.values()].map((item) => ({ ...item }))
          trace.push(`reconcile:${route}:snapshot`)
          await hooks.afterSnapshot?.({ sessionSnapshot, mealSnapshot, trace })

          const plan = planPendingTrainingMealReconciliation(mealSnapshot, sessionSnapshot)
          let applied = 0

          for (const action of plan) {
            const current = state.meals.get(action.mealId)
            if (!current) continue

            if (action.type === 'soft-delete') {
              current.deletedAt = `reconciled:${route}`
              current.version += 1
              applied += 1
            } else if (current.date !== action.targetDate) {
              current.date = action.targetDate
              current.version += 1
              applied += 1
            }
          }

          await hooks.beforeCommit?.({ plan, trace })
          trace.push(`reconcile:${route}:commit:${applied}`)
          return applied > 0
        })

        if (changed) {
          bus.publish('nutrition')
        }
        return changed
      } finally {
        activeReconciliations -= 1
        trace.push(`reconcile:${route}:end`)
      }
    })
  }

  function assertConsistency() {
    for (const meal of state.meals.values()) {
      if (
        meal.deletedAt !== null ||
        meal.status !== 'pending' ||
        !meal.trainingSessionId ||
        (meal.role !== 'preworkout' && meal.role !== 'postworkout')
      ) {
        continue
      }

      const session = state.sessions.get(meal.trainingSessionId)
      assert.ok(session, `Missing session for active Training meal ${meal.id}`)

      if (session.deletedAt === null && session.status !== 'omitted') {
        assert.equal(
          meal.date,
          session.scheduledDate,
          `${meal.id} must match ${session.id}.scheduledDate`,
        )
      }
    }
  }

  return {
    state,
    bus,
    trace,
    reconcile,
    reprogram,
    omit,
    assertConsistency,
    reconciliationQueue,
    storeTransactionQueue,
    getMaxActiveReconciliations: () => maxActiveReconciliations,
  }
}

const X = '2026-09-08'
const Y = '2026-09-09'
const Z = '2026-09-10'
const W = '2026-09-11'

// F01 — X -> Y -> Z with A paused after snapshot. The shared store transaction
// prevents Training Z from committing underneath A; B then observes Z.
{
  const h = createHarness({
    sessions: [baseSession('session-a', X)],
    meals: [baseMeal({ id: 'meal-a', sessionId: 'session-a', date: X })],
  })
  await h.reprogram('session-a', Y)

  const snapshotReached = deferred()
  const allowA = deferred()
  const a = h.reconcile('day-a', {
    afterSnapshot: async () => {
      snapshotReached.resolve()
      await allowA.promise
    },
  })
  await snapshotReached.promise

  let zCommitted = false
  const zMutation = h.reprogram('session-a', Z).then(() => { zCommitted = true })
  await Promise.resolve()
  assert.equal(zCommitted, false, 'Training Z must not commit inside A transaction snapshot/write window')

  const b = h.reconcile('day-b')
  allowA.resolve()
  await Promise.all([a, zMutation, b])

  assert.equal(h.state.sessions.get('session-a').scheduledDate, Z)
  assert.equal(h.state.meals.get('meal-a').date, Z)
  h.assertConsistency()
}

// F02 — old work cannot finish after a newer reconciliation because every
// reconciliation shares one global queue.
{
  const h = createHarness({
    sessions: [baseSession('session-a', Y)],
    meals: [baseMeal({ id: 'meal-a', sessionId: 'session-a', date: X })],
  })
  const snapshotReached = deferred()
  const allowOld = deferred()
  const old = h.reconcile('old', {
    afterSnapshot: async () => {
      snapshotReached.resolve()
      await allowOld.promise
    },
  })
  await snapshotReached.promise
  const training = h.reprogram('session-a', Z)
  const newer = h.reconcile('new')
  allowOld.resolve()
  await Promise.all([old, training, newer])
  assert.equal(h.getMaxActiveReconciliations(), 1)
  assert.ok(h.trace.indexOf('reconcile:old:end') < h.trace.indexOf('reconcile:new:start'))
  h.assertConsistency()
}

// F03 — Day A + Day B share global reconciliation even with distinct date keys.
{
  const h = createHarness({
    sessions: [baseSession('session-a', Z)],
    meals: [baseMeal({ id: 'meal-a', sessionId: 'session-a', date: X })],
  })
  await Promise.all([h.reconcile('day-2026-09-08'), h.reconcile('day-2026-09-10')])
  assert.equal(h.getMaxActiveReconciliations(), 1)
  h.assertConsistency()
}

// F04 — Day + Week share the same exclusion.
{
  const h = createHarness({
    sessions: [baseSession('session-a', Z)],
    meals: [baseMeal({ id: 'meal-a', sessionId: 'session-a', date: X })],
  })
  await Promise.all([h.reconcile('day'), h.reconcile('week')])
  assert.equal(h.getMaxActiveReconciliations(), 1)
  h.assertConsistency()
}

// F05 — Week + Day inverse order remains serialized and coherent.
{
  const h = createHarness({
    sessions: [baseSession('session-a', Z)],
    meals: [baseMeal({ id: 'meal-a', sessionId: 'session-a', date: X })],
  })
  await Promise.all([h.reconcile('week'), h.reconcile('day')])
  assert.equal(h.getMaxActiveReconciliations(), 1)
  h.assertConsistency()
}

// F06 — X -> Y -> Z -> W with interleaved reconciliations ends at W.
{
  const h = createHarness({
    sessions: [baseSession('session-a', X)],
    meals: [baseMeal({ id: 'meal-a', sessionId: 'session-a', date: X })],
  })
  for (const [index, date] of [Y, Z, W].entries()) {
    await h.reprogram('session-a', date)
    await Promise.all([
      h.reconcile(`day-${index}`),
      h.reconcile(`week-${index}`),
    ])
  }
  assert.equal(h.state.meals.get('meal-a').date, W)
  h.assertConsistency()
}

// F07 — omitted concurrent with a reconciliation cannot be hidden under a stale
// snapshot. A follow-up global reconciliation observes omitted and removes the
// still-pending Training meal according to the existing rule.
{
  const h = createHarness({
    sessions: [baseSession('session-a', Y)],
    meals: [baseMeal({ id: 'meal-a', sessionId: 'session-a', date: X })],
  })
  const snapshotReached = deferred()
  const allowA = deferred()
  const a = h.reconcile('day-old', {
    afterSnapshot: async () => {
      snapshotReached.resolve()
      await allowA.promise
    },
  })
  await snapshotReached.promise
  const omitted = h.omit('session-a')
  const current = h.reconcile('day-current')
  allowA.resolve()
  await Promise.all([a, omitted, current])
  assert.notEqual(h.state.meals.get('meal-a').deletedAt, null)
  h.assertConsistency()
}

// F08 — changing A does not alter B or completed/skipped B records.
{
  const h = createHarness({
    sessions: [baseSession('session-a', Z), baseSession('session-b', Y)],
    meals: [
      baseMeal({ id: 'pre-a', sessionId: 'session-a', date: X }),
      baseMeal({ id: 'pre-b', sessionId: 'session-b', date: Y }),
      baseMeal({ id: 'post-b-completed', sessionId: 'session-b', date: Y, role: 'postworkout', status: 'completed' }),
      baseMeal({ id: 'post-b-skipped', sessionId: 'session-b', date: Y, role: 'postworkout', status: 'skipped' }),
    ],
  })
  await h.reconcile('day')
  assert.equal(h.state.meals.get('pre-a').date, Z)
  assert.equal(h.state.meals.get('pre-b').date, Y)
  assert.equal(h.state.meals.get('post-b-completed').status, 'completed')
  assert.equal(h.state.meals.get('post-b-skipped').status, 'skipped')
  h.assertConsistency()
}

// F09 — global stress drains both queues, does not starve, and the event revision
// stabilizes once mutations/reconciliations stop.
{
  const h = createHarness({
    sessions: [baseSession('session-a', X)],
    meals: [baseMeal({ id: 'meal-a', sessionId: 'session-a', date: X })],
  })
  const dates = [X, Y, Z, W]
  const work = []
  for (let index = 0; index < 100; index += 1) {
    const date = dates[index % dates.length]
    work.push((async () => {
      await h.reprogram('session-a', date)
      await Promise.all([
        h.reconcile(`day-a-${index}`),
        h.reconcile(`day-b-${index}`),
        h.reconcile(`week-${index}`),
      ])
    })())
  }
  await Promise.all(work)
  await h.reconcile('final')
  h.assertConsistency()
  assert.equal(h.reconciliationQueue.pendingKeys(), 0)
  assert.equal(h.storeTransactionQueue.pendingKeys(), 0)
  assert.equal(h.getMaxActiveReconciliations(), 1)
  const stableRevision = h.bus.getRevision()
  await Promise.resolve()
  await Promise.resolve()
  assert.equal(h.bus.getRevision(), stableRevision)
}

// F10 — a reconciliation that actually changes persistence publishes once; the
// immediate no-op reconciliation publishes nothing, so there is no signal loop.
{
  const h = createHarness({
    sessions: [baseSession('session-a', Z)],
    meals: [baseMeal({ id: 'meal-a', sessionId: 'session-a', date: X })],
  })
  let nutritionEvents = 0
  h.bus.subscribe((event) => {
    if (event.source === 'nutrition') nutritionEvents += 1
  })
  const changed = await h.reconcile('changed')
  assert.equal(changed, true)
  assert.equal(nutritionEvents, 1)
  const noOp = await h.reconcile('noop')
  assert.equal(noOp, false)
  assert.equal(nutritionEvents, 1)
  h.assertConsistency()
}

console.log('F2-B01 F01-F10 global Nutrition reconciliation causality: PASS')
