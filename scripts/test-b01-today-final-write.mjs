import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createLatestWinsGate } from '../src/app/latestWins.ts'
import { createFreshnessEventBus } from '../src/app/freshnessEvents.ts'

class StaleWriteError extends Error {}

function deferred() {
  let resolve
  const promise = new Promise((done) => {
    resolve = done
  })
  return { promise, resolve }
}

function clone(value) {
  return structuredClone(value)
}

async function transaction(initialState, callback) {
  const draft = clone(initialState)

  try {
    await callback(draft)
    return { committed: true, state: draft }
  } catch (error) {
    if (error instanceof StaleWriteError) {
      return { committed: false, state: clone(initialState) }
    }

    throw error
  }
}

function assertCurrent(gate, token) {
  if (!gate.isCurrent(token)) {
    throw new StaleWriteError()
  }
}

async function guardedWrite(gate, token, write) {
  assertCurrent(gate, token)
  await write()
  assertCurrent(gate, token)
}

// D08 — stale during bulkPut rolls the transaction back.
{
  const gate = createLatestWinsGate()
  const tokenA = gate.begin()
  const inFlight = deferred()
  const initial = { tasks: [{ id: 'task-1', context: 'initial' }] }

  const tx = transaction(initial, async (draft) => {
    await guardedWrite(gate, tokenA, async () => {
      draft.tasks[0].context = 'pending'
      await inFlight.promise
    })
  })

  gate.begin() // B makes A stale while the write is in flight.
  inFlight.resolve()

  const result = await tx
  assert.equal(result.committed, false)
  assert.equal(result.state.tasks[0].context, 'initial')
}

// D09 — stale during dailyRoutines.add when add is the last write rolls back.
{
  const gate = createLatestWinsGate()
  const tokenA = gate.begin()
  const inFlight = deferred()
  const initial = { routines: [] }

  const tx = transaction(initial, async (draft) => {
    await guardedWrite(gate, tokenA, async () => {
      draft.routines.push({ id: 'routine-a', date: '2026-09-06' })
      await inFlight.promise
    })
    assertCurrent(gate, tokenA)
  })

  gate.begin()
  inFlight.resolve()

  const result = await tx
  assert.equal(result.committed, false)
  assert.equal(result.state.routines.length, 0)
}

// D10 — stale during bulkAdd rolls back both routine and tasks from one transaction.
{
  const gate = createLatestWinsGate()
  const tokenA = gate.begin()
  const inFlight = deferred()
  const initial = { routines: [], tasks: [] }

  const tx = transaction(initial, async (draft) => {
    assertCurrent(gate, tokenA)
    draft.routines.push({ id: 'routine-a', date: '2026-09-06' })
    assertCurrent(gate, tokenA)

    await guardedWrite(gate, tokenA, async () => {
      draft.tasks.push({ id: 'task-a', routineId: 'routine-a' })
      await inFlight.promise
    })

    assertCurrent(gate, tokenA)
  })

  gate.begin()
  inFlight.resolve()

  const result = await tx
  assert.equal(result.committed, false)
  assert.equal(result.state.routines.length, 0)
  assert.equal(result.state.tasks.length, 0)
}

// D11 — rollover makes old-day A stale; A cannot persist on day N.
{
  const gate = createLatestWinsGate()
  const tokenA = gate.begin()
  const inFlight = deferred()
  const initial = {
    days: {
      '2026-09-06': 'initial-06',
      '2026-09-07': 'initial-07',
    },
  }

  const txA = transaction(initial, async (draft) => {
    await guardedWrite(gate, tokenA, async () => {
      draft.days['2026-09-06'] = 'stale-pending'
      await inFlight.promise
    })
  })

  const tokenB = gate.begin() // rollover => load for N+1
  const txB = transaction(initial, async (draft) => {
    await guardedWrite(gate, tokenB, async () => {
      draft.days['2026-09-07'] = 'current-omitted'
    })
  })

  inFlight.resolve()

  const [resultA, resultB] = await Promise.all([txA, txB])
  assert.equal(resultA.committed, false)
  assert.equal(resultA.state.days['2026-09-06'], 'initial-06')
  assert.equal(resultB.committed, true)
  assert.equal(resultB.state.days['2026-09-07'], 'current-omitted')
}

// D12 — post-commit Training invalidation plus rollover cannot let an old write survive.
{
  const gate = createLatestWinsGate()
  const bus = createFreshnessEventBus()
  const tokenA = gate.begin()
  const inFlight = deferred()
  let visibleDate = '2026-09-06'
  let tokenB = null

  const unsubscribe = bus.subscribe((event) => {
    assert.equal(event.source, 'training')
    visibleDate = '2026-09-07' // same stabilization window includes rollover
    tokenB = gate.begin()
  })

  const initial = {
    days: {
      '2026-09-06': 'initial-06',
      '2026-09-07': 'initial-07',
    },
  }

  const txA = transaction(initial, async (draft) => {
    await guardedWrite(gate, tokenA, async () => {
      draft.days['2026-09-06'] = 'stale-training-context'
      await inFlight.promise
    })
  })

  bus.publish('training')
  assert.equal(visibleDate, '2026-09-07')
  assert.ok(tokenB)

  const txB = transaction(initial, async (draft) => {
    await guardedWrite(gate, tokenB, async () => {
      draft.days['2026-09-07'] = 'current-training-context'
    })
  })

  inFlight.resolve()

  const [resultA, resultB] = await Promise.all([txA, txB])
  unsubscribe()

  assert.equal(resultA.committed, false)
  assert.equal(resultA.state.days['2026-09-06'], 'initial-06')
  assert.equal(resultB.committed, true)
  assert.equal(resultB.state.days['2026-09-07'], 'current-training-context')
  assert.equal(bus.getRevision(), 1)
}

// Source-level proof that the actual transaction paths have post-write guards.
{
  const source = await readFile(
    new URL('../src/features/today/todayService.ts', import.meta.url),
    'utf8',
  )

  assert.match(
    source,
    /await db\s*\.dailyRoutineTasks\s*\.bulkPut\(changedTasks\)[\s\S]*?assertPersistenceCurrent\(canPersist\)/,
    'bulkPut must be followed by an in-transaction causal guard',
  )

  assert.match(
    source,
    /await db\s*\.dailyRoutines\s*\.add\(routine\)[\s\S]*?assertPersistenceCurrent\(canPersist\)[\s\S]*?if \(tasks\.length > 0\)/,
    'dailyRoutines.add must be followed by a guard before the optional bulkAdd path',
  )

  assert.match(
    source,
    /await db\s*\.dailyRoutineTasks\s*\.bulkAdd\(tasks\)[\s\S]*?assertPersistenceCurrent\(canPersist\)/,
    'bulkAdd must be followed by an in-transaction causal guard',
  )

  const finalMarker = '// Last synchronous causal check before the transaction callback exits.'
  const markerIndex = source.indexOf(finalMarker)
  assert.notEqual(markerIndex, -1, 'creation path must document its final causal boundary')
  const tail = source.slice(markerIndex, source.indexOf('      },\n    )', markerIndex))
  assert.match(tail, /assertPersistenceCurrent\(canPersist\)/)
  assert.doesNotMatch(tail.split('assertPersistenceCurrent(canPersist)').at(-1), /await\s/)
}

console.log('F2-B01 D08-D12 Today final-write rollback causality: PASS')
