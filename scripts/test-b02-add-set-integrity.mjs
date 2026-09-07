import assert from 'node:assert/strict'

function serialQueue() {
  let tail = Promise.resolve()
  return async (task) => {
    const run = tail.then(task, task)
    tail = run.catch(() => undefined)
    return run
  }
}

function makeHarness({ sessionStatus = 'active', sessionDeleted = false, snapshotDeleted = false, inconsistentLinkage = false } = {}) {
  const tx = serialQueue()
  const state = {
    session: {
      id: inconsistentLinkage ? 'ws-other' : 'ws-1',
      status: sessionStatus,
      deletedAt: sessionDeleted ? 'deleted' : null,
    },
    snapshot: {
      id: 'snap-1',
      workoutSessionId: 'ws-1',
      deletedAt: snapshotDeleted ? 'deleted' : null,
    },
    sets: [
      { id: 'set-1', workoutSessionId: 'ws-1', workoutSessionExerciseId: 'snap-1', setType: 'working', order: 1, deletedAt: null },
      { id: 'set-2', workoutSessionId: 'ws-1', workoutSessionExerciseId: 'snap-1', setType: 'working', order: 2, deletedAt: null },
      { id: 'warmup-1', workoutSessionId: 'ws-1', workoutSessionExerciseId: 'snap-1', setType: 'warmup', order: 1, deletedAt: null },
    ],
    events: 0,
    seq: 0,
  }

  const activeSets = (type = null) => state.sets.filter((set) =>
    set.deletedAt === null && (!type || set.setType === type),
  )

  async function add(setType = 'working') {
    return tx(async () => {
      const snapshot = state.snapshot
      if (!snapshot || snapshot.deletedAt !== null) throw new Error('snapshot invalid')
      const session = state.session
      if (!session || session.deletedAt !== null) throw new Error('session invalid')
      if (session.status !== 'active') throw new Error('session terminal')
      if (snapshot.workoutSessionId !== session.id) throw new Error('linkage invalid')

      const current = activeSets(setType).filter((set) => set.workoutSessionExerciseId === snapshot.id)
      const nextOrder = current.reduce((max, set) => Math.max(max, set.order), 0) + 1
      const created = {
        id: `new-${++state.seq}`,
        workoutSessionId: session.id,
        workoutSessionExerciseId: snapshot.id,
        setType,
        order: nextOrder,
        deletedAt: null,
      }
      state.sets.push(created)
      state.events += 1
      return created
    })
  }

  async function discard() {
    return tx(async () => {
      if (state.session.deletedAt !== null || state.session.status !== 'active') throw new Error('not active')
      state.session.deletedAt = 'discarded'
      state.snapshot.deletedAt = 'discarded'
      for (const set of activeSets()) set.deletedAt = 'discarded'
      state.events += 1
    })
  }

  async function finish(result = 'completed') {
    return tx(async () => {
      if (state.session.deletedAt !== null || state.session.status !== 'active') throw new Error('not active')
      state.session.status = result
      state.events += 1
    })
  }

  async function remove(setId) {
    return tx(async () => {
      const set = state.sets.find((item) => item.id === setId)
      if (!set || set.deletedAt !== null) return false
      set.deletedAt = 'removed'
      state.events += 1
      return true
    })
  }

  return { state, add, discard, finish, remove, activeSets }
}

function assertReferenceIntegrity(h) {
  for (const set of h.activeSets()) {
    assert.ok(h.state.snapshot, 'active set must have snapshot')
    assert.equal(h.state.snapshot.deletedAt, null, 'active set snapshot must be active')
    assert.ok(h.state.session, 'active set must have session')
    assert.equal(h.state.session.deletedAt, null, 'active set session must not be soft-deleted')
    assert.equal(h.state.snapshot.workoutSessionId, set.workoutSessionId)
    assert.equal(h.state.session.id, set.workoutSessionId)
  }
}

function assertUniqueActiveOrders(h) {
  const seen = new Set()
  for (const set of h.activeSets()) {
    const key = `${set.workoutSessionExerciseId}|${set.setType}|${set.order}`
    assert.ok(!seen.has(key), `duplicate active order: ${key}`)
    seen.add(key)
  }
}

// U01 — add wins, discard follows and soft-deletes the new child.
{
  const h = makeHarness()
  const added = await h.add('working')
  await h.discard()
  assert.equal(h.state.sets.find((s) => s.id === added.id).deletedAt, 'discarded')
  assert.equal(h.activeSets().length, 0)
}

// U02 — discard wins, add re-reads and rejects with zero add event.
{
  const h = makeHarness()
  await h.discard()
  const eventsBefore = h.state.events
  const countBefore = h.state.sets.length
  await assert.rejects(() => h.add('working'), /snapshot invalid|session invalid/)
  assert.equal(h.state.events, eventsBefore)
  assert.equal(h.state.sets.length, countBefore)
}

// U03 — finish completed wins, add rejects.
{
  const h = makeHarness()
  await h.finish('completed')
  const before = h.state.events
  await assert.rejects(() => h.add(), /session terminal/)
  assert.equal(h.state.events, before)
}

// U04 — finish incomplete wins, add rejects.
{
  const h = makeHarness()
  await h.finish('incomplete')
  const before = h.state.events
  await assert.rejects(() => h.add(), /session terminal/)
  assert.equal(h.state.events, before)
}

// U05 — add wins, finish follows: serial state is valid and child remains historical.
{
  const h = makeHarness()
  const added = await h.add()
  await h.finish('completed')
  assert.equal(h.state.session.status, 'completed')
  assert.equal(h.state.sets.find((s) => s.id === added.id).deletedAt, null)
  assertUniqueActiveOrders(h)
}

// U06 — two concurrent adds produce 3 and 4.
{
  const h = makeHarness()
  const [a, b] = await Promise.all([h.add(), h.add()])
  assert.deepEqual([a.order, b.order].sort((x, y) => x - y), [3, 4])
  assertUniqueActiveOrders(h)
}

// U07 — ten concurrent adds produce ten unique ids/orders.
{
  const h = makeHarness()
  const added = await Promise.all(Array.from({ length: 10 }, () => h.add()))
  assert.equal(new Set(added.map((s) => s.id)).size, 10)
  assert.equal(new Set(added.map((s) => s.order)).size, 10)
  assert.deepEqual(added.map((s) => s.order).sort((a, b) => a - b), [3,4,5,6,7,8,9,10,11,12])
  assertUniqueActiveOrders(h)
}

// U08 — add/remove in both serial orders: no duplicate order and no resurrect.
{
  const h1 = makeHarness()
  const added = await h1.add()
  await h1.remove('set-2')
  assert.equal(h1.state.sets.find((s) => s.id === 'set-2').deletedAt, 'removed')
  assert.equal(h1.state.sets.find((s) => s.id === added.id).deletedAt, null)
  assertUniqueActiveOrders(h1)

  const h2 = makeHarness()
  await h2.remove('set-2')
  const replacement = await h2.add()
  assert.equal(replacement.order, 2)
  assert.equal(h2.state.sets.find((s) => s.id === 'set-2').deletedAt, 'removed')
  assertUniqueActiveOrders(h2)
}

// U09 — snapshot soft-deleted rejects without event.
{
  const h = makeHarness({ snapshotDeleted: true })
  const before = h.state.events
  await assert.rejects(() => h.add(), /snapshot invalid/)
  assert.equal(h.state.events, before)
}

// U10 — session soft-deleted rejects without event.
{
  const h = makeHarness({ sessionDeleted: true })
  const before = h.state.events
  await assert.rejects(() => h.add(), /session invalid/)
  assert.equal(h.state.events, before)
}

// U11 — terminal sessions reject.
for (const status of ['completed', 'incomplete', 'cancelled']) {
  const h = makeHarness({ sessionStatus: status })
  const before = h.state.events
  await assert.rejects(() => h.add(), /session terminal/)
  assert.equal(h.state.events, before)
}

// U12 — inconsistent snapshot/session linkage rejects.
{
  const h = makeHarness({ inconsistentLinkage: true })
  const before = h.state.events
  await assert.rejects(() => h.add(), /linkage invalid/)
  assert.equal(h.state.events, before)
}

// Working/warmup order sequences remain independent.
{
  const h = makeHarness()
  const [working, warmup] = await Promise.all([h.add('working'), h.add('warmup')])
  assert.equal(working.order, 3)
  assert.equal(warmup.order, 2)
  assertUniqueActiveOrders(h)
}

// Deterministic stress over add/remove/finish/discard orders.
for (let i = 0; i < 100; i += 1) {
  const h = makeHarness()
  if (i % 4 === 0) {
    await Promise.all([h.add(), h.add(), h.add()])
    await h.remove('set-2')
    assertReferenceIntegrity(h)
    assertUniqueActiveOrders(h)
  } else if (i % 4 === 1) {
    await Promise.all([h.add(), h.add()])
    await h.discard()
    assert.equal(h.activeSets().length, 0)
  } else if (i % 4 === 2) {
    await h.add()
    await h.finish('completed')
    assertUniqueActiveOrders(h)
  } else {
    await h.finish('incomplete')
    const before = h.state.events
    await assert.rejects(() => h.add(), /session terminal/)
    assert.equal(h.state.events, before)
  }
}

console.log('F2-B02 U01-U12 addExerciseSet parent/order integrity: PASS (stress 100 cycles)')
