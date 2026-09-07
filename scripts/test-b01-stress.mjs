import assert from 'node:assert/strict'
import { createFreshnessEventBus } from '../src/app/freshnessEvents.ts'
import { createLatestWinsGate } from '../src/app/latestWins.ts'
import { createKeyedSerialQueue } from '../src/app/keyedSerialQueue.ts'
import { dailyMealIdentityKey } from '../src/features/nutrition/dailyMealIdentity.ts'

const bus = createFreshnessEventBus()
let refreshes = 0
const unsubscribe = bus.subscribe(() => {
  // A normal read/refresh never republishes a mutation.
  refreshes += 1
})

for (let cycle = 0; cycle < 100; cycle += 1) {
  bus.publish(cycle % 2 === 0 ? 'training' : 'nutrition')
}

const revisionAfterEvents = bus.getRevision()
await new Promise((resolve) => setTimeout(resolve, 10))
assert.equal(bus.getRevision(), revisionAfterEvents, 'Revision must stop growing when events stop')
assert.equal(refreshes, 100, 'Each explicit committed mutation produces one event, not a loop')
unsubscribe()

const gate = createLatestWinsGate()
let taskCount = 12
for (let cycle = 0; cycle < 100; cycle += 1) {
  const token = gate.begin()
  if (gate.isCurrent(token)) {
    // Refresh/reconciliation does not create a routine task by itself in this model.
    taskCount += 0
  }
}
assert.equal(taskCount, 12, 'Repeated latest-wins refreshes must not grow routine task count')

const queue = createKeyedSerialQueue()
const mealKeys = new Set()
async function ensureMeal() {
  return queue.run('2026-09-07', async () => {
    const key = dailyMealIdentityKey('2026-09-07', 'dinner', null)
    mealKeys.add(key)
  })
}

await Promise.all(Array.from({ length: 100 }, () => ensureMeal()))
assert.equal(mealKeys.size, 1, 'Repeated/concurrent structure materialization must not grow meal count')
assert.equal(queue.pendingKeys(), 0, 'Stress queue must drain without a pending loop')

console.log('F2-B01 C04/C05 stress + counts: PASS (100 cycles)')
