import assert from 'node:assert/strict'
import { createLatestWinsGate } from '../src/app/latestWins.ts'

const gate = createLatestWinsGate()
let persistedContext = 'initial'

// A reads old Training=pending.
const requestA = gate.begin()
const contextA = 'pending'

// B starts later and reads Training=omitted.
const requestB = gate.begin()
const contextB = 'omitted'

// B applies the current context.
assert.equal(gate.isCurrent(requestB), true)
persistedContext = contextB

// A is deliberately forced to finish after B.
if (gate.isCurrent(requestA)) {
  persistedContext = contextA
}

assert.equal(
  persistedContext,
  'omitted',
  'A stale load must not become the final persistent writer after B',
)
assert.equal(gate.isCurrent(requestA), false, 'Older request token must be invalidated')
assert.equal(gate.getRevision(), 2, 'Exactly two causal loads must advance the gate twice')

console.log('F2-B01 C03 Today latest-wins persistence guard: PASS')
