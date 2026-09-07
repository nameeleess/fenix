import assert from 'node:assert/strict'
import fs from 'node:fs'

const serviceSource = fs.readFileSync('src/features/training/trainingService.ts', 'utf8')
const removeStart = serviceSource.indexOf('export async function removeExerciseSet')
const removeEnd = serviceSource.indexOf('export async function startRestTimer', removeStart)
assert.ok(removeStart >= 0 && removeEnd > removeStart, 'removeExerciseSet source region not found')
const removeSource = serviceSource.slice(removeStart, removeEnd)

for (const required of [
  "db.transaction(\n    'rw'",
  'db.workoutSessions',
  'db.workoutSessionExercises',
  'db.exerciseSets',
  'const set = await db.exerciseSets.get(setId)',
  'set.completedAt !== null',
  'const snapshot = await db.workoutSessionExercises.get',
  'const session = await db.workoutSessions.get(set.workoutSessionId)',
  "session.status !== 'active'",
  'version: set.version + 1',
  "publishCommittedMutation('training')",
]) {
  assert.ok(removeSource.includes(required), `removeExerciseSet missing invariant: ${required}`)
}
assert.ok(
  removeSource.indexOf("publishCommittedMutation('training')") > removeSource.lastIndexOf('db.transaction('),
  'remove publish must be after the transaction',
)

function initialState() {
  return {
    session: { id: 'ws', status: 'active', deletedAt: null, version: 1 },
    snapshot: { id: 'snap', workoutSessionId: 'ws', deletedAt: null, version: 1 },
    sets: new Map([
      ['target', { id: 'target', workoutSessionId: 'ws', workoutSessionExerciseId: 'snap', setType: 'working', order: 1, reps: 8, completedAt: null, deletedAt: null, version: 1 }],
    ]),
    events: [],
  }
}

function cloneState(state) {
  return {
    session: structuredClone(state.session),
    snapshot: structuredClone(state.snapshot),
    sets: new Map([...state.sets].map(([id, set]) => [id, structuredClone(set)])),
    events: [...state.events],
  }
}

function requireParents(state, set) {
  if (!set || set.deletedAt !== null) throw new Error('set unavailable')
  if (!state.snapshot || state.snapshot.deletedAt !== null || state.snapshot.id !== set.workoutSessionExerciseId) throw new Error('snapshot unavailable')
  if (!state.session || state.session.deletedAt !== null || state.session.id !== set.workoutSessionId) throw new Error('session unavailable')
  if (state.snapshot.workoutSessionId !== state.session.id) throw new Error('linkage')
  if (state.session.status !== 'active') throw new Error('session terminal')
}

function removeCurrent(state, id = 'target') {
  const set = state.sets.get(id)
  requireParents(state, set)
  if (set.completedAt !== null) throw new Error('completed cannot remove')
  set.deletedAt = 'removed'
  set.version += 1
  state.events.push('remove')
}

function toggleCurrent(state, id = 'target') {
  const set = state.sets.get(id)
  requireParents(state, set)
  if (set.completedAt === null) {
    if (!Number.isInteger(set.reps) || set.reps < 1) throw new Error('invalid completion')
    set.completedAt = 'completed'
  } else {
    set.completedAt = null
  }
  set.version += 1
  state.events.push('toggle')
}

function finishCurrent(state, resolution = 'completed') {
  if (state.session.deletedAt !== null || state.session.status !== 'active') throw new Error('session unavailable')
  const completedWorking = [...state.sets.values()].filter((set) => set.deletedAt === null && set.setType === 'working' && set.completedAt !== null)
  if (completedWorking.length === 0) throw new Error('no completed work')
  state.session.status = resolution
  state.session.version += 1
  state.events.push(`finish:${resolution}`)
}

function discardCurrent(state) {
  if (state.session.deletedAt !== null || state.session.status !== 'active') throw new Error('session unavailable')
  const completedWorking = [...state.sets.values()].filter((set) => set.deletedAt === null && set.setType === 'working' && set.completedAt !== null)
  if (completedWorking.length > 0) throw new Error('completed work protects discard')
  state.session.deletedAt = 'discarded'
  state.snapshot.deletedAt = 'discarded'
  for (const set of state.sets.values()) if (set.deletedAt === null) set.deletedAt = 'discarded'
  state.events.push('discard')
}

function addCurrent(state, setType = 'working') {
  if (state.session.deletedAt !== null || state.session.status !== 'active' || state.snapshot.deletedAt !== null) throw new Error('parent unavailable')
  const orders = [...state.sets.values()].filter((set) => set.deletedAt === null && set.setType === setType).map((set) => set.order)
  const order = (orders.length ? Math.max(...orders) : 0) + 1
  const id = `add-${state.sets.size}`
  state.sets.set(id, { id, workoutSessionId: 'ws', workoutSessionExerciseId: 'snap', setType, order, reps: null, completedAt: null, deletedAt: null, version: 1 })
  state.events.push('add')
  return id
}

function assertNoActiveOrphans(state) {
  for (const set of state.sets.values()) {
    if (set.deletedAt !== null) continue
    assert.equal(state.session.deletedAt, null)
    assert.equal(state.snapshot.deletedAt, null)
    assert.equal(state.session.id, set.workoutSessionId)
    assert.equal(state.snapshot.id, set.workoutSessionExerciseId)
    assert.equal(state.snapshot.workoutSessionId, state.session.id)
  }
}

// R01: remove intent starts while uncompleted, toggle completes, finish terminalizes, stale remove gets its turn -> reject/no event.
{
  const state = initialState()
  const eventCount = state.events.length
  toggleCurrent(state)
  finishCurrent(state, 'completed')
  assert.throws(() => removeCurrent(state), /completed|terminal/)
  assert.equal(state.events.length, eventCount + 2)
  assert.equal(state.sets.get('target').deletedAt, null)
  assert.notEqual(state.sets.get('target').completedAt, null)
}

// R02: stale remove cannot erase newly completed work and enable discard.
{
  const state = initialState()
  toggleCurrent(state)
  assert.throws(() => removeCurrent(state), /completed/)
  assert.throws(() => discardCurrent(state), /completed work/)
  assert.equal(state.session.deletedAt, null)
}

// R03: remove wins first; toggle later sees deleted child and rejects.
{
  const state = initialState()
  removeCurrent(state)
  assert.throws(() => toggleCurrent(state), /set unavailable/)
  assert.equal(state.sets.get('target').deletedAt, 'removed')
}

// R04: finish wins first; remove rejects terminal lifecycle without version regression.
{
  const state = initialState()
  toggleCurrent(state)
  finishCurrent(state, 'incomplete')
  const before = structuredClone(state.sets.get('target'))
  assert.throws(() => removeCurrent(state), /completed|terminal/)
  assert.deepEqual(state.sets.get('target'), before)
}

// R05: remove wins before a finish that has no other completed work; finish rejects using current sets.
{
  const state = initialState()
  removeCurrent(state)
  assert.throws(() => finishCurrent(state), /no completed work/)
  assert.equal(state.session.status, 'active')
}

// R06: remove vs add has a serial result, no duplicate active order / orphan.
{
  const state = initialState()
  removeCurrent(state)
  addCurrent(state)
  assertNoActiveOrphans(state)
  const active = [...state.sets.values()].filter((set) => set.deletedAt === null && set.setType === 'working')
  assert.equal(new Set(active.map((set) => set.order)).size, active.length)
}

// R07: two removes serialize; loser is a no-write/no-event rejection.
{
  const state = initialState()
  removeCurrent(state)
  const events = state.events.length
  assert.throws(() => removeCurrent(state), /set unavailable/)
  assert.equal(state.events.length, events)
}

// R08: direct terminal/deleted parents reject.
for (const status of ['completed', 'incomplete', 'cancelled']) {
  const state = initialState()
  state.session.status = status
  assert.throws(() => removeCurrent(state), /terminal/)
  assert.equal(state.events.length, 0)
}
{
  const state = initialState(); state.session.deletedAt = 'x'
  assert.throws(() => removeCurrent(state), /session unavailable/)
  assert.equal(state.events.length, 0)
}
{
  const state = initialState(); state.snapshot.deletedAt = 'x'
  assert.throws(() => removeCurrent(state), /snapshot unavailable/)
  assert.equal(state.events.length, 0)
}

// R09: linkage inconsistency rejects.
{
  const state = initialState(); state.snapshot.workoutSessionId = 'other'
  assert.throws(() => removeCurrent(state), /linkage/)
  assert.equal(state.events.length, 0)
}

// R10: 200 deterministic lifecycle stress cycles preserve references and finish evidence.
for (let index = 0; index < 200; index += 1) {
  const state = initialState()
  if (index % 4 === 0) {
    toggleCurrent(state)
    assert.throws(() => removeCurrent(state), /completed/)
    finishCurrent(state, index % 8 === 0 ? 'completed' : 'incomplete')
  } else if (index % 4 === 1) {
    removeCurrent(state)
    addCurrent(state)
  } else if (index % 4 === 2) {
    addCurrent(state)
    toggleCurrent(state)
    finishCurrent(state)
  } else {
    removeCurrent(state)
    discardCurrent(state)
  }
  assertNoActiveOrphans(state)
  if (state.session.status === 'completed' || state.session.status === 'incomplete') {
    const evidence = [...state.sets.values()].filter((set) => set.deletedAt === null && set.setType === 'working' && set.completedAt !== null)
    assert.ok(evidence.length >= 1, 'terminal session lost completed working evidence')
  }
}

console.log('F2-RC1 Training remove/lifecycle causality: PASS (R01-R10 + 200 stress cycles)')
