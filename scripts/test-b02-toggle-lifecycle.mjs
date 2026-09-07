import assert from 'node:assert/strict'
import { validateSetValues } from '../src/features/training/trainingIntegrityPolicy.ts'

function serialQueue() {
  let tail = Promise.resolve()
  let pending = 0
  return {
    run(task) {
      pending += 1
      const run = tail.then(task, task)
      tail = run.catch(() => undefined).finally(() => { pending -= 1 })
      return run
    },
    async drain() { await tail },
    pending() { return pending },
  }
}

function deferred() {
  let resolve
  const promise = new Promise((r) => { resolve = r })
  return { promise, resolve }
}

function makeHarness({
  sessionStatus = 'active',
  sessionDeleted = false,
  snapshotDeleted = false,
  snapshotSessionId = 'ws-1',
  targetCompleted = true,
  extraCompleted = 0,
} = {}) {
  const queue = serialQueue()
  const state = {
    session: { id: 'ws-1', status: sessionStatus, deletedAt: sessionDeleted ? 'deleted' : null },
    snapshot: { id: 'snap-1', workoutSessionId: snapshotSessionId, deletedAt: snapshotDeleted ? 'deleted' : null },
    sets: [
      {
        id: 'target', workoutSessionId: 'ws-1', workoutSessionExerciseId: 'snap-1',
        setType: 'working', weight: 100, reps: targetCompleted ? 8 : 0, rir: 2,
        completedAt: targetCompleted ? 't0' : null, deletedAt: null, version: 1, updatedAt: 't0',
      },
      ...Array.from({ length: extraCompleted }, (_, index) => ({
        id: `extra-${index}`, workoutSessionId: 'ws-1', workoutSessionExerciseId: 'snap-1',
        setType: 'working', weight: 100, reps: 8, rir: 2,
        completedAt: `t${index + 1}`, deletedAt: null, version: 1, updatedAt: `t${index + 1}`,
      })),
    ],
    events: [],
    clock: 1,
  }

  const now = () => `time-${++state.clock}`
  const getSet = (id) => state.sets.find((set) => set.id === id)
  const activeSets = () => state.sets.filter((set) => set.deletedAt === null)
  const completedWorking = () => activeSets().filter((set) => set.setType === 'working' && set.completedAt !== null)

  function publish(op) { state.events.push(op) }

  async function toggle(setId, values, acquireGate = null) {
    if (acquireGate) await acquireGate
    const result = await queue.run(async () => {
      const set = getSet(setId)
      if (!set || set.deletedAt !== null) throw new Error('set invalid')

      const session = state.session
      if (!session || session.deletedAt !== null) throw new Error('session unavailable')
      if (session.status !== 'active') throw new Error('session not active')

      if (set.workoutSessionExerciseId) {
        const snapshot = state.snapshot
        if (!snapshot || snapshot.deletedAt !== null) throw new Error('snapshot unavailable')
        if (snapshot.workoutSessionId !== session.id) throw new Error('snapshot linkage invalid')
      }

      if (set.completedAt !== null) {
        validateSetValues(values, set.setType, 'draft')
        set.weight = values.weight
        set.reps = values.reps
        set.rir = values.rir
        set.completedAt = null
        set.updatedAt = now()
        set.version += 1
        return false
      }

      validateSetValues(values, set.setType, 'complete')
      set.weight = values.weight
      set.reps = values.reps
      set.rir = values.rir
      set.completedAt = now()
      set.updatedAt = set.completedAt
      set.version += 1
      return true
    })
    publish('toggle')
    return result
  }

  async function finish(result = 'completed') {
    const out = await queue.run(async () => {
      if (state.session.deletedAt !== null || state.session.status !== 'active') throw new Error('not active')
      if (completedWorking().length === 0) throw new Error('no completed working sets')
      state.session.status = result
      return result
    })
    publish('finish')
    return out
  }

  async function discard() {
    const out = await queue.run(async () => {
      if (state.session.deletedAt !== null || state.session.status !== 'active') throw new Error('not active')
      if (completedWorking().length > 0) throw new Error('real work exists')
      state.session.deletedAt = now()
      state.snapshot.deletedAt = state.session.deletedAt
      for (const set of activeSets()) set.deletedAt = state.session.deletedAt
      return true
    })
    publish('discard')
    return out
  }

  async function save(setId, values, acquireGate = null) {
    if (acquireGate) await acquireGate
    const result = await queue.run(async () => {
      const set = getSet(setId)
      if (!set || set.deletedAt !== null) throw new Error('set invalid')
      const mode = set.completedAt === null ? 'draft' : 'complete'
      validateSetValues(values, set.setType, mode)
      set.weight = values.weight
      set.reps = values.reps
      set.rir = values.rir
      set.updatedAt = now()
      set.version += 1
      return true
    })
    publish('save')
    return result
  }

  function assertCompletedDomain() {
    for (const set of activeSets().filter((item) => item.completedAt !== null)) {
      validateSetValues({ weight: set.weight, reps: set.reps, rir: set.rir }, set.setType, 'complete')
    }
  }

  function assertReferences() {
    for (const set of activeSets()) {
      assert.equal(state.snapshot.deletedAt, null)
      assert.equal(state.session.deletedAt, null)
      assert.equal(state.snapshot.workoutSessionId, set.workoutSessionId)
      assert.equal(state.session.id, set.workoutSessionId)
    }
  }

  function assertTerminalizationInvariant() {
    if (state.session.deletedAt === null && ['completed', 'incomplete'].includes(state.session.status)) {
      assert.ok(completedWorking().length >= 1, 'terminal session must retain completed working evidence')
    }
  }

  return { state, toggle, finish, discard, save, queue, getSet, completedWorking, assertCompletedDomain, assertReferences, assertTerminalizationInvariant }
}

const completeValues = { weight: 100, reps: 8, rir: 2 }
const draftValues = { weight: 100, reps: 8, rir: 2 }

// V01 — uncomplete request starts first, finish completed gets transaction first.
{
  const h = makeHarness({ targetCompleted: true })
  const gate = deferred()
  const beforeEvents = h.state.events.length
  const staleToggle = h.toggle('target', draftValues, gate.promise)
  await h.finish('completed')
  gate.resolve()
  await assert.rejects(staleToggle, /session not active/)
  assert.equal(h.state.session.status, 'completed')
  assert.notEqual(h.getSet('target').completedAt, null)
  assert.equal(h.state.events.filter((event) => event === 'toggle').length, 0)
  assert.equal(h.state.events.length, beforeEvents + 1)
  h.assertTerminalizationInvariant()
}

// V02 — toggle wins; finish completed must observe zero completed working sets and reject.
{
  const h = makeHarness({ targetCompleted: true })
  await h.toggle('target', draftValues)
  const beforeFinish = h.state.events.length
  await assert.rejects(() => h.finish('completed'), /no completed working sets/)
  assert.equal(h.state.session.status, 'active')
  assert.equal(h.getSet('target').completedAt, null)
  assert.equal(h.state.events.length, beforeFinish)
}

// V03 — finish incomplete wins; stale uncomplete rejects.
{
  const h = makeHarness({ targetCompleted: true })
  const gate = deferred()
  const staleToggle = h.toggle('target', draftValues, gate.promise)
  await h.finish('incomplete')
  gate.resolve()
  await assert.rejects(staleToggle, /session not active/)
  assert.equal(h.state.session.status, 'incomplete')
  assert.notEqual(h.getSet('target').completedAt, null)
  h.assertTerminalizationInvariant()
}

// V04 — toggle wins; finish incomplete rejects on current set state.
{
  const h = makeHarness({ targetCompleted: true })
  await h.toggle('target', draftValues)
  await assert.rejects(() => h.finish('incomplete'), /no completed working sets/)
  assert.equal(h.state.session.status, 'active')
}

// V05 — stale completion cannot add work after finish.
{
  const h = makeHarness({ targetCompleted: false, extraCompleted: 1 })
  const gate = deferred()
  const staleToggle = h.toggle('target', completeValues, gate.promise)
  await h.finish('completed')
  gate.resolve()
  await assert.rejects(staleToggle, /session not active/)
  assert.equal(h.getSet('target').completedAt, null)
  assert.equal(h.state.events.filter((event) => event === 'toggle').length, 0)
  h.assertTerminalizationInvariant()
}

// V06 — lifecycle guard applies even when another completed set would remain.
{
  const h = makeHarness({ targetCompleted: true, extraCompleted: 1 })
  const gate = deferred()
  const staleToggle = h.toggle('target', draftValues, gate.promise)
  await h.finish('completed')
  gate.resolve()
  await assert.rejects(staleToggle, /session not active/)
  assert.notEqual(h.getSet('target').completedAt, null)
  assert.equal(h.completedWorking().length, 2)
}

// V07 — direct terminal/deleted/linkage-invalid parents reject with zero write/event.
for (const fixture of [
  { sessionStatus: 'completed' },
  { sessionStatus: 'incomplete' },
  { sessionStatus: 'cancelled' },
  { sessionDeleted: true },
  { snapshotDeleted: true },
  { snapshotSessionId: 'ws-other' },
]) {
  const h = makeHarness({ targetCompleted: true, ...fixture })
  const before = structuredClone(h.getSet('target'))
  const events = h.state.events.length
  await assert.rejects(() => h.toggle('target', draftValues))
  assert.deepEqual(h.getSet('target'), before)
  assert.equal(h.state.events.length, events)
}

// V08 — toggle vs discard, both serial orders.
{
  const h = makeHarness({ targetCompleted: false })
  await h.toggle('target', completeValues)
  await assert.rejects(() => h.discard(), /real work exists/)
  assert.equal(h.state.session.deletedAt, null)
  assert.notEqual(h.getSet('target').completedAt, null)
}
{
  const h = makeHarness({ targetCompleted: false })
  const gate = deferred()
  const staleToggle = h.toggle('target', completeValues, gate.promise)
  await h.discard()
  gate.resolve()
  await assert.rejects(staleToggle, /set invalid|session unavailable/)
  assert.notEqual(h.state.session.deletedAt, null)
  assert.notEqual(h.getSet('target').deletedAt, null)
  assert.equal(h.state.events.filter((event) => event === 'toggle').length, 0)
}

// V09 — save vs finish: save never changes completedAt or invalidates finish evidence.
{
  const h = makeHarness({ targetCompleted: true })
  const completedAt = h.getSet('target').completedAt
  await Promise.all([h.save('target', { weight: 105, reps: 9, rir: 1 }), h.finish('completed')])
  assert.equal(h.state.session.status, 'completed')
  assert.equal(h.getSet('target').completedAt, completedAt)
  h.assertCompletedDomain()
  h.assertTerminalizationInvariant()
}
{
  const h = makeHarness({ targetCompleted: true })
  const gate = deferred()
  const delayedSave = h.save('target', { weight: 105, reps: 9, rir: 1 }, gate.promise)
  await h.finish('completed')
  gate.resolve()
  await delayedSave
  assert.equal(h.state.session.status, 'completed')
  assert.notEqual(h.getSet('target').completedAt, null)
  h.assertCompletedDomain()
  h.assertTerminalizationInvariant()
}

// V10 — deterministic lifecycle stress, including stale requests after terminalization.
for (let i = 0; i < 100; i += 1) {
  if (i % 5 === 0) {
    const h = makeHarness({ targetCompleted: true })
    const gate = deferred()
    const stale = h.toggle('target', draftValues, gate.promise)
    await h.finish(i % 10 === 0 ? 'completed' : 'incomplete')
    gate.resolve()
    await assert.rejects(stale, /session not active/)
    await h.queue.drain()
    h.assertTerminalizationInvariant()
    h.assertCompletedDomain()
    h.assertReferences()
    assert.equal(h.queue.pending(), 0)
  } else if (i % 5 === 1) {
    const h = makeHarness({ targetCompleted: true })
    await h.toggle('target', draftValues)
    await assert.rejects(() => h.finish('completed'), /no completed working sets/)
    assert.equal(h.state.session.status, 'active')
  } else if (i % 5 === 2) {
    const h = makeHarness({ targetCompleted: false })
    await h.toggle('target', completeValues)
    await assert.rejects(() => h.discard(), /real work exists/)
    h.assertCompletedDomain()
    h.assertReferences()
  } else if (i % 5 === 3) {
    const h = makeHarness({ targetCompleted: false })
    const gate = deferred()
    const stale = h.toggle('target', completeValues, gate.promise)
    await h.discard()
    gate.resolve()
    await assert.rejects(stale)
    assert.equal(h.state.events.filter((event) => event === 'toggle').length, 0)
  } else {
    const h = makeHarness({ targetCompleted: true })
    const beforeCompletedAt = h.getSet('target').completedAt
    await Promise.all([h.save('target', { weight: 110, reps: 10, rir: 0 }), h.finish('completed')])
    assert.equal(h.getSet('target').completedAt, beforeCompletedAt)
    h.assertTerminalizationInvariant()
    h.assertCompletedDomain()
  }
}

console.log('F2-B02 V01-V10 toggle/session lifecycle causality: PASS (stress 100 cycles)')
