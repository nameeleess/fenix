import assert from 'node:assert/strict'

process.env.TZ = 'Europe/Madrid'

const {
  compareDateKeys,
  getLocalDateKey,
  parseDateKey,
  shiftDateKey,
  startOfWeek,
} = await import('../src/utils/date.ts')

assert.equal(shiftDateKey('2026-03-28', 1), '2026-03-29')
assert.equal(shiftDateKey('2026-03-29', 1), '2026-03-30')
assert.equal(shiftDateKey('2026-10-24', 1), '2026-10-25')
assert.equal(shiftDateKey('2026-10-25', 1), '2026-10-26')
assert.equal(startOfWeek('2026-09-06'), '2026-08-31')
assert.equal(startOfWeek('2026-09-07'), '2026-09-07')
assert.equal(getLocalDateKey(new Date('2026-03-28T23:30:00.000Z')), '2026-03-29')
assert.equal(getLocalDateKey(new Date('2026-10-24T22:30:00.000Z')), '2026-10-25')
assert.equal(compareDateKeys('2026-09-06', '2026-09-07') < 0, true)
assert.equal(parseDateKey('2028-02-29').getDate(), 29)
assert.throws(() => parseDateKey('2026-02-29'), /Fecha no válida/)
assert.throws(() => parseDateKey('2026-9-7'), /Fecha no válida/)

console.log('FÉNIX v2.1 date/timezone policy: PASS (Europe/Madrid DST + strict YYYY-MM-DD)')
