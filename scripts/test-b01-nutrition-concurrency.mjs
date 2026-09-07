import assert from 'node:assert/strict'
import { createKeyedSerialQueue } from '../src/app/keyedSerialQueue.ts'
import { dailyMealIdentityKey } from '../src/features/nutrition/dailyMealIdentity.ts'

const queue = createKeyedSerialQueue()
const meals = []

async function materialize(date, role, trainingSessionId = null) {
  return queue.run(date, async () => {
    // Force interleaving opportunities before the revalidation.
    await Promise.resolve()

    const key = dailyMealIdentityKey(date, role, trainingSessionId)
    const exists = meals.some((meal) => meal.key === key && meal.deletedAt === null)

    if (!exists) {
      meals.push({ key, date, role, trainingSessionId, deletedAt: null })
    }

    return key
  })
}

const date = '2026-09-07'

await Promise.all([
  materialize(date, 'main_meal'),
  materialize(date, 'main_meal'),
  materialize(date, 'main_meal'),
])

assert.equal(
  meals.filter((meal) => meal.key === dailyMealIdentityKey(date, 'main_meal', null)).length,
  1,
  'Three concurrent non-Training materializations must produce one date+role identity',
)

await Promise.all([
  materialize(date, 'preworkout', 'session-a'),
  materialize(date, 'preworkout', 'session-a'),
  materialize(date, 'preworkout', 'session-a'),
])

assert.equal(
  meals.filter((meal) => meal.key === dailyMealIdentityKey(date, 'preworkout', 'session-a')).length,
  1,
  'Training meals must deduplicate by date+role+trainingSessionId',
)

await Promise.all([
  materialize(date, 'preworkout', 'session-b'),
  materialize(date, 'postworkout', 'session-a'),
])

assert.equal(
  meals.filter((meal) => meal.role === 'preworkout').length,
  2,
  'Different Training session identities must remain representable',
)
assert.equal(
  meals.filter((meal) => meal.key === dailyMealIdentityKey(date, 'postworkout', 'session-a')).length,
  1,
  'Pre/Post roles have independent identities',
)
assert.equal(queue.pendingKeys(), 0, 'Queue must drain completely after concurrent materialization')

console.log('F2-B01 C02 Nutrition concurrency: PASS (non-Training + Training identity)')
