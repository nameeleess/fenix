import assert from 'node:assert/strict'
import {
  getCurrentLocalDateKey,
  millisecondsUntilNextLocalDay,
} from '../src/app/freshnessPolicy.ts'

const sample = new Date(2026, 8, 6, 15, 44, 0, 0)
assert.equal(
  getCurrentLocalDateKey(sample),
  '2026-09-06',
  'Local date key must reflect the supplied local calendar day',
)

const late = new Date(2026, 8, 6, 23, 59, 59, 900)
const delay = millisecondsUntilNextLocalDay(late)
assert.ok(delay >= 250, 'Rollover timer must not schedule a zero/negative loop')
assert.ok(delay < 1000, 'Near midnight rollover must be detected promptly')

const nextDay = new Date(2026, 8, 7, 0, 0, 0, 100)
assert.equal(
  getCurrentLocalDateKey(nextDay),
  '2026-09-07',
  'Date key must advance after local midnight',
)

console.log('F2-B01 freshness policy tests: PASS (3 scenarios)')
