import assert from 'node:assert/strict'
import {
  assertPlannedCanStart,
  assertPlannedPending,
  comparePlannedWorkoutSessions,
  isValidTrainingDateKey,
  validateSetValues,
} from '../src/features/training/trainingIntegrityPolicy.ts'

function serialQueue() {
  let tail = Promise.resolve()
  return async (task) => {
    const run = tail.then(task, task)
    tail = run.catch(() => undefined)
    return run
  }
}

function planned(id, status = 'pending', date = '2026-09-08', templateId = 'template-a') {
  return {
    id,
    workoutTemplateId: templateId,
    templateName: templateId,
    originalScheduledDate: date,
    scheduledDate: date,
    status,
    executionSessionId: null,
    isFormalStrength: true,
    isExtra: false,
    estimatedDurationMinutes: 60,
    rescheduleCount: 0,
    resolvedAt: null,
    notes: null,
    createdAt: `2026-09-01T00:00:0${id.slice(-1) || '0'}Z`,
    updatedAt: '2026-09-01T00:00:00Z',
    deletedAt: null,
    version: 1,
  }
}

function createHarness(planneds) {
  const state = {
    planned: new Map(planneds.map((item) => [item.id, { ...item }])),
    sessions: new Map(),
    snapshots: [],
    sets: [],
    events: 0,
    sequence: 0,
  }
  const tx = serialQueue()

  function activeSessions() {
    return [...state.sessions.values()].filter((s) => s.status === 'active' && s.deletedAt === null)
  }

  async function start(plannedId = null, templateId = 'template-a') {
    return tx(async () => {
      const active = activeSessions()
      assert.ok(active.length <= 1)

      if (plannedId) {
        const p = state.planned.get(plannedId)
        assert.ok(p && p.deletedAt === null)
        assertPlannedCanStart(p.status)

        if (p.status === 'in_progress') {
          if (!p.executionSessionId) throw new Error('integrity: missing execution')
          const execution = state.sessions.get(p.executionSessionId)
          if (!execution || execution.deletedAt !== null || execution.status !== 'active' || execution.plannedWorkoutId !== p.id) {
            throw new Error('integrity: invalid execution')
          }
          if (active.length !== 1 || active[0].id !== execution.id) throw new Error('integrity: active mismatch')
          return execution.id
        }

        if (active.length === 1) {
          if (active[0].plannedWorkoutId === p.id) throw new Error('integrity: pending with active execution')
          return active[0].id
        }
      } else if (active.length === 1) {
        return active[0].id
      }

      const id = `execution-${++state.sequence}`
      state.sessions.set(id, {
        id,
        status: 'active',
        deletedAt: null,
        plannedWorkoutId: plannedId,
        workoutTemplateId: templateId,
      })
      state.snapshots.push({ workoutSessionId: id })
      state.sets.push({ workoutSessionId: id })
      if (plannedId) {
        const p = state.planned.get(plannedId)
        p.status = 'in_progress'
        p.executionSessionId = id
        p.version += 1
      }
      state.events += 1
      return id
    })
  }

  async function finish(id, result = 'completed') {
    return tx(async () => {
      const session = state.sessions.get(id)
      if (!session || session.deletedAt !== null || session.status !== 'active') throw new Error('not active')
      session.status = result
      if (session.plannedWorkoutId) {
        const p = state.planned.get(session.plannedWorkoutId)
        if (!p || p.status !== 'in_progress' || p.executionSessionId !== id) throw new Error('integrity planned')
        p.status = result
        p.version += 1
      }
      state.events += 1
    })
  }

  async function discard(id) {
    return tx(async () => {
      const session = state.sessions.get(id)
      if (!session || session.deletedAt !== null || session.status !== 'active') throw new Error('not active')
      session.deletedAt = 'discarded'
      if (session.plannedWorkoutId) {
        const p = state.planned.get(session.plannedWorkoutId)
        if (!p || p.status !== 'in_progress' || p.executionSessionId !== id) throw new Error('integrity planned')
        p.status = 'pending'
        p.executionSessionId = null
        p.version += 1
      }
      state.events += 1
    })
  }

  async function omit(id) {
    return tx(async () => {
      const p = state.planned.get(id)
      assertPlannedPending(p.status, 'omit')
      p.status = 'omitted'
      p.version += 1
      state.events += 1
    })
  }

  async function reprogram(id, newDate) {
    if (!isValidTrainingDateKey(newDate)) throw new Error('invalid date')
    return tx(async () => {
      const p = state.planned.get(id)
      assertPlannedPending(p.status, 'reprogram')
      if (p.scheduledDate === newDate) return false
      p.scheduledDate = newDate
      p.rescheduleCount += 1
      p.version += 1
      state.events += 1
      return true
    })
  }

  return { state, start, finish, discard, omit, reprogram, activeSessions }
}

// T01 — same planned concurrent.
{
  const h = createHarness([planned('p1')])
  const ids = await Promise.all([h.start('p1'), h.start('p1')])
  assert.equal(new Set(ids).size, 1)
  assert.equal(h.activeSessions().length, 1)
  assert.equal(h.state.snapshots.length, 1)
  assert.equal(h.state.sets.length, 1)
  assert.equal(h.state.planned.get('p1').executionSessionId, ids[0])
}

// T02 — distinct planned concurrent.
{
  const h = createHarness([planned('p1'), planned('p2')])
  await Promise.all([h.start('p1'), h.start('p2')])
  assert.equal(h.activeSessions().length, 1)
  const inProgress = [...h.state.planned.values()].filter((p) => p.status === 'in_progress')
  const pending = [...h.state.planned.values()].filter((p) => p.status === 'pending')
  assert.equal(inProgress.length, 1)
  assert.equal(pending.length, 1)
  assert.equal(pending[0].executionSessionId, null)
}

// T03 — planned + template.
{
  const h = createHarness([planned('p1')])
  await Promise.all([h.start('p1'), h.start(null, 'template-extra')])
  assert.equal(h.activeSessions().length, 1)
  assert.equal(h.state.sessions.size, 1)
}

// T04 — ten starts, no orphans.
{
  const h = createHarness(Array.from({ length: 5 }, (_, i) => planned(`p${i}`)))
  await Promise.all(Array.from({ length: 10 }, (_, i) => i % 2 ? h.start(`p${i % 5}`) : h.start(null, 'template-extra')))
  assert.equal(h.activeSessions().length, 1)
  assert.equal(h.state.sessions.size, 1)
  assert.equal(h.state.snapshots.length, 1)
  assert.equal(h.state.sets.length, 1)
}

// T05 — finish winner then start another.
{
  const h = createHarness([planned('p1'), planned('p2')])
  const first = await h.start('p1')
  await h.finish(first)
  const second = await h.start('p2')
  assert.notEqual(first, second)
  assert.equal(h.activeSessions().length, 1)
}

// T06 — discard then start another.
{
  const h = createHarness([planned('p1'), planned('p2')])
  const first = await h.start('p1')
  await h.discard(first)
  const second = await h.start('p2')
  assert.notEqual(first, second)
  assert.equal(h.activeSessions().length, 1)
}

// T07 — valid in_progress reuses execution.
{
  const p = planned('p1', 'in_progress')
  p.executionSessionId = 'execution-existing'
  const h = createHarness([p])
  h.state.sessions.set('execution-existing', { id: 'execution-existing', status: 'active', deletedAt: null, plannedWorkoutId: 'p1', workoutTemplateId: 'template-a' })
  const result = await h.start('p1')
  assert.equal(result, 'execution-existing')
  assert.equal(h.state.sessions.size, 1)
}

// T08 — inconsistent in_progress is explicit and non-destructive.
{
  const p = planned('p1', 'in_progress')
  p.executionSessionId = 'missing'
  const h = createHarness([p])
  await assert.rejects(() => h.start('p1'), /integrity/)
  assert.equal(h.state.sessions.size, 0)
  assert.equal(h.state.snapshots.length, 0)
  assert.equal(h.state.sets.length, 0)
}

// T09-T13 transitions.
{
  const h = createHarness([planned('completed-path'), planned('incomplete-path'), planned('omit-path'), planned('reprogram-path'), planned('discard-path')])
  const c = await h.start('completed-path'); await h.finish(c, 'completed'); assert.equal(h.state.planned.get('completed-path').status, 'completed') // T09
  const i = await h.start('incomplete-path'); await h.finish(i, 'incomplete'); assert.equal(h.state.planned.get('incomplete-path').status, 'incomplete') // T10
  await h.omit('omit-path'); assert.equal(h.state.planned.get('omit-path').status, 'omitted') // T11
  await h.reprogram('reprogram-path', '2026-09-09'); assert.equal(h.state.planned.get('reprogram-path').status, 'pending') // T12
  const d = await h.start('discard-path'); await h.discard(d); assert.equal(h.state.planned.get('discard-path').status, 'pending') // T13
}

// T14-T16 terminal planned transitions rejected.
for (const status of ['completed', 'incomplete', 'omitted']) {
  assert.throws(() => assertPlannedCanStart(status), /resuelta/)
  assert.throws(() => assertPlannedPending(status, 'reprogram'), /pendiente/)
  assert.throws(() => assertPlannedPending(status, 'omit'), /pendiente/)
}

// T17 finish twice.
{
  const h = createHarness([planned('p1')])
  const id = await h.start('p1')
  await h.finish(id)
  const events = h.state.events
  await assert.rejects(() => h.finish(id), /not active/)
  assert.equal(h.state.events, events)
}

// T18/T19 same-day identities preserved and deterministically sorted.
{
  const a = planned('a', 'pending', '2026-09-08', 'template-a')
  const b = planned('b', 'pending', '2026-09-08', 'template-b')
  b.createdAt = a.createdAt
  const sorted = [b, a].sort(comparePlannedWorkoutSessions)
  assert.deepEqual(sorted.map((x) => x.id), ['a', 'b']) // T18 distinct template
  const c = planned('c', 'pending', '2026-09-08', 'template-a')
  assert.equal([a, c].filter((x) => x.scheduledDate === '2026-09-08').length, 2) // T19 same template
}

// T20-T23 same-day operations isolate identities.
{
  const a = planned('a', 'pending', '2026-09-08', 'template-a')
  const b = planned('b', 'pending', '2026-09-09', 'template-b')
  const h = createHarness([a, b])
  await h.reprogram('a', '2026-09-09')
  assert.equal(h.state.planned.get('a').scheduledDate, h.state.planned.get('b').scheduledDate) // T20
  await h.omit('a')
  assert.equal(h.state.planned.get('b').status, 'pending') // T21
}
{
  const h = createHarness([planned('a'), planned('b')])
  const aExecution = await h.start('a')
  assert.equal(h.state.planned.get('b').status, 'pending') // T22
  await h.finish(aExecution)
  const bExecution = await h.start('b')
  assert.ok(bExecution)
  assert.equal(h.state.planned.get('b').status, 'in_progress') // T23
}

// T24/T25 week projection/count semantics operate on identities, not unique dates.
{
  const sessions = [planned('a'), planned('b')]
  assert.equal(sessions.filter((x) => x.scheduledDate === '2026-09-08').length, 2) // T24
  assert.equal(sessions.length, 2) // T25
}

// T26-T30 date validation.
for (const invalid of ['2026-02-30', '2026-04-31', '2026-13-01', '2025-02-29', '2026-9-1', 'not-a-date']) {
  assert.equal(isValidTrainingDateKey(invalid), false, `must reject ${invalid}`)
}
assert.equal(isValidTrainingDateKey('2028-02-29'), true)

// T31 same date is a true no-op.
{
  const p = planned('p1', 'pending', '2026-09-08')
  const h = createHarness([p])
  const before = { ...h.state.planned.get('p1') }
  const events = h.state.events
  const changed = await h.reprogram('p1', '2026-09-08')
  assert.equal(changed, false)
  assert.deepEqual(h.state.planned.get('p1'), before)
  assert.equal(h.state.events, events)
}

function valid(values, setType = 'working', mode = 'draft') {
  validateSetValues(values, setType, mode)
}
function invalid(values, setType = 'working', mode = 'draft') {
  assert.throws(() => validateSetValues(values, setType, mode))
}

// T32-T40 set domain.
invalid({ weight: -1, reps: 1, rir: 1 }) // T32
for (const weight of [NaN, Infinity, -Infinity]) invalid({ weight, reps: 1, rir: 1 }) // T33
invalid({ weight: 0, reps: -1, rir: 1 }) // T34
invalid({ weight: 0, reps: 1.5, rir: 1 }) // T35
invalid({ weight: 0, reps: 0, rir: 1 }, 'working', 'complete'); invalid({ weight: 0, reps: null, rir: 1 }, 'working', 'complete') // T36
invalid({ weight: 0, reps: 1, rir: -0.1 }); invalid({ weight: 0, reps: 1, rir: 10.1 }) // T37
invalid({ weight: 0, reps: 1, rir: NaN }); invalid({ weight: 0, reps: 1, rir: Infinity }) // T38
invalid({ weight: 0, reps: 5, rir: 1 }, 'warmup', 'draft') // T39
valid({ weight: 0, reps: 0, rir: 0 }, 'working', 'draft'); valid({ weight: 0, reps: 1, rir: 10 }, 'working', 'complete'); valid({ weight: null, reps: null, rir: null }, 'warmup', 'draft') // T40

console.log('F2-B02 T01-T40 Training integrity: PASS')

function createSetHarness(initialSets) {
  const state = {
    sets: new Map(initialSets.map((set) => [set.id, { ...set }])),
    events: 0,
  }
  const tx = serialQueue()

  async function save(setId, values, beforeTx = async () => {}) {
    await beforeTx()
    await tx(async () => {
      const set = state.sets.get(setId)
      if (!set || set.deletedAt !== null) throw new Error('Serie no encontrada.')
      const mode = set.completedAt === null ? 'draft' : 'complete'
      validateSetValues(values, set.setType, mode)
      set.weight = values.weight
      set.reps = values.reps
      set.rir = values.rir
      set.updatedAt = `update-${set.version + 1}`
      set.version += 1
    })
    state.events += 1
  }

  async function toggle(setId, values, beforeTx = async () => {}) {
    await beforeTx()
    const result = await tx(async () => {
      const set = state.sets.get(setId)
      if (!set || set.deletedAt !== null) throw new Error('Serie no encontrada.')

      if (set.completedAt !== null) {
        validateSetValues(values, set.setType, 'draft')
        set.weight = values.weight
        set.reps = values.reps
        set.rir = values.rir
        set.completedAt = null
        set.updatedAt = `update-${set.version + 1}`
        set.version += 1
        return false
      }

      validateSetValues(values, set.setType, 'complete')
      set.weight = values.weight
      set.reps = values.reps
      set.rir = values.rir
      set.completedAt = `complete-${set.version + 1}`
      set.updatedAt = `update-${set.version + 1}`
      set.version += 1
      return true
    })
    state.events += 1
    return result
  }

  return { state, save, toggle }
}

function exerciseSet(id, overrides = {}) {
  return {
    id,
    setType: 'working',
    weight: 20,
    reps: 8,
    rir: 2,
    completedAt: null,
    deletedAt: null,
    version: 1,
    updatedAt: 'initial',
    ...overrides,
  }
}

function snapshotSet(set) {
  return JSON.parse(JSON.stringify(set))
}

// T41 — completed set cannot be saved with reps=0.
{
  const h = createSetHarness([exerciseSet('s1', { completedAt: 'done' })])
  const before = snapshotSet(h.state.sets.get('s1'))
  const events = h.state.events
  await assert.rejects(() => h.save('s1', { weight: 20, reps: 0, rir: 2 }), /repetición/i)
  assert.deepEqual(h.state.sets.get('s1'), before)
  assert.equal(h.state.events, events)
}

// T42 — completed set cannot be saved with reps=null.
{
  const h = createSetHarness([exerciseSet('s1', { completedAt: 'done' })])
  const before = snapshotSet(h.state.sets.get('s1'))
  const events = h.state.events
  await assert.rejects(() => h.save('s1', { weight: 20, reps: null, rir: 2 }), /repetición/i)
  assert.deepEqual(h.state.sets.get('s1'), before)
  assert.equal(h.state.events, events)
}

// T43 — completed set accepts valid edits and preserves completedAt.
{
  const h = createSetHarness([exerciseSet('s1', { completedAt: 'done' })])
  await h.save('s1', { weight: 22.5, reps: 9, rir: 1 })
  const set = h.state.sets.get('s1')
  assert.equal(set.completedAt, 'done')
  assert.equal(set.weight, 22.5)
  assert.equal(set.reps, 9)
  assert.equal(set.rir, 1)
  assert.equal(h.state.events, 1)
}

// T44 — completed warmup never accepts non-null RIR.
{
  const h = createSetHarness([exerciseSet('s1', { setType: 'warmup', completedAt: 'done', rir: null })])
  const before = snapshotSet(h.state.sets.get('s1'))
  await assert.rejects(() => h.save('s1', { weight: 10, reps: 5, rir: 1 }), /calentamiento/i)
  assert.deepEqual(h.state.sets.get('s1'), before)
  assert.equal(h.state.events, 0)
}

// T45 — save request starts while draft, completion commits first; save must re-read completed state and reject reps=0.
{
  const h = createSetHarness([exerciseSet('s1')])
  let releaseSave
  const saveBarrier = new Promise((resolve) => { releaseSave = resolve })
  const savePromise = h.save('s1', { weight: 20, reps: 0, rir: 2 }, () => saveBarrier)
  await h.toggle('s1', { weight: 20, reps: 8, rir: 2 })
  releaseSave()
  await assert.rejects(() => savePromise, /repetición/i)
  const set = h.state.sets.get('s1')
  assert.notEqual(set.completedAt, null)
  assert.equal(set.reps, 8)
  assert.equal(h.state.events, 1)
}

// T46 — completed save request starts first, uncomplete commits first; save must not restore completedAt from stale state.
{
  const h = createSetHarness([exerciseSet('s1', { completedAt: 'done' })])
  let releaseSave
  const saveBarrier = new Promise((resolve) => { releaseSave = resolve })
  const savePromise = h.save('s1', { weight: 25, reps: 10, rir: 0 }, () => saveBarrier)
  await h.toggle('s1', { weight: 20, reps: 8, rir: 2 })
  releaseSave()
  await savePromise
  const set = h.state.sets.get('s1')
  assert.equal(set.completedAt, null)
  assert.equal(set.reps, 10)
  assert.equal(set.weight, 25)
  validateSetValues({ weight: set.weight, reps: set.reps, rir: set.rir }, set.setType, 'draft')
  assert.equal(h.state.events, 2)
}

// T47 — concurrent toggles serialize and every resulting completed state satisfies complete domain.
{
  const h = createSetHarness([exerciseSet('s1')])
  await Promise.all([
    h.toggle('s1', { weight: 20, reps: 8, rir: 2 }),
    h.toggle('s1', { weight: 20, reps: 8, rir: 2 }),
  ])
  const set = h.state.sets.get('s1')
  if (set.completedAt !== null) {
    validateSetValues({ weight: set.weight, reps: set.reps, rir: set.rir }, set.setType, 'complete')
  }
  assert.equal(set.version, 3)
  assert.equal(h.state.events, 2)
}

// T48 — invalid save has zero persistence/version/timestamp/completion/event effects.
{
  const h = createSetHarness([exerciseSet('s1', { completedAt: 'done' })])
  const before = snapshotSet(h.state.sets.get('s1'))
  const events = h.state.events
  await assert.rejects(() => h.save('s1', { weight: -1, reps: 8, rir: 2 }))
  assert.deepEqual(h.state.sets.get('s1'), before)
  assert.equal(h.state.events, events)
}

// Completed-set invariant after T32-T48 style coverage.
{
  const h = createSetHarness([
    exerciseSet('working-complete', { completedAt: 'done', reps: 1, rir: 0, weight: 0 }),
    exerciseSet('warmup-complete', { setType: 'warmup', completedAt: 'done', reps: 5, rir: null, weight: 0 }),
    exerciseSet('draft', { completedAt: null, reps: 0, rir: 10, weight: 0 }),
  ])

  for (const set of h.state.sets.values()) {
    if (set.deletedAt !== null || set.completedAt === null) continue
    validateSetValues(
      { weight: set.weight, reps: set.reps, rir: set.rir },
      set.setType,
      'complete',
    )
  }
}

console.log('F2-B02 T41-T48 ExerciseSet transactional domain: PASS')
