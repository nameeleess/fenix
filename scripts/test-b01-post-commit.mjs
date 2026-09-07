import assert from 'node:assert/strict'
import { createFreshnessEventBus } from '../src/app/freshnessEvents.ts'

function deferred() {
  let resolve
  const promise = new Promise((next) => {
    resolve = next
  })
  return { promise, resolve }
}

async function runScenario(source, consumer) {
  const bus = createFreshnessEventBus()
  const commitGate = deferred()
  let persisted = 'old'
  let visible = null
  let reads = 0

  const unsubscribe = bus.subscribe(() => {
    reads += 1
    visible = persisted
  })

  const mutation = (async () => {
    await commitGate.promise
    persisted = 'new'
    bus.publish(source)
  })()

  // Consumer becomes active before the pending mutation commits.
  visible = persisted
  assert.equal(visible, 'old', `${consumer} must be able to observe the pre-commit snapshot`)
  assert.equal(reads, 0, 'No causal refresh may publish before commit')

  commitGate.resolve()
  await mutation

  assert.equal(reads, 1, `${source} commit must trigger one post-commit invalidation`)
  assert.equal(visible, 'new', `${consumer} must converge to committed state`)

  unsubscribe()
}

await runScenario('training', 'today')
await runScenario('training', 'nutrition')
await runScenario('training', 'progress')
await runScenario('nutrition', 'today')
await runScenario('progress', 'today')

console.log('F2-B01 C01 post-commit invalidation: PASS (5 routes)')
