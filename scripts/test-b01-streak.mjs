import assert from 'node:assert/strict'
import { calculateTrainingStreak } from '../src/features/progress/trainingStreakPolicy.ts'

const today = '2026-09-06'

function session({
  id,
  date,
  status = 'completed',
  extra = false,
  formal = true,
  deletedAt = null,
}) {
  return {
    id,
    createdAt: `${date}T08:00:00.000Z`,
    deletedAt,
    scheduledDate: date,
    status,
    isFormalStrength: formal,
    isExtra: extra,
  }
}

function previousDate(index) {
  const date = new Date('2026-09-06T12:00:00')
  date.setDate(date.getDate() - index)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const longStreak = Array.from({ length: 35 }, (_, index) =>
  session({
    id: `long-${index}`,
    date: previousDate(34 - index),
  }),
)
assert.deepEqual(
  calculateTrainingStreak(longStreak, today),
  { streak: 35, pending: false },
  'AC-B01-09: a streak longer than 28 days must not be truncated',
)

assert.deepEqual(
  calculateTrainingStreak(
    [
      session({ id: 'c1', date: '2026-09-03' }),
      session({ id: 'c2', date: '2026-09-04' }),
      session({ id: 'pending', date: '2026-09-05', status: 'pending' }),
    ],
    today,
  ),
  { streak: 2, pending: true },
  'AC-B01-10: pending must leave the streak unresolved, not convert to failure',
)

assert.deepEqual(
  calculateTrainingStreak(
    [
      session({ id: 'c1', date: '2026-09-03' }),
      session({ id: 'in-progress', date: '2026-09-05', status: 'in_progress' }),
    ],
    today,
  ),
  { streak: 1, pending: true },
  'AC-B01-10: in_progress must leave the streak unresolved',
)

assert.deepEqual(
  calculateTrainingStreak(
    [
      session({ id: 'c1', date: '2026-09-03' }),
      session({ id: 'omitted', date: '2026-09-05', status: 'omitted' }),
    ],
    today,
  ),
  { streak: 0, pending: false },
  'AC-B01-11: omitted must break the streak',
)

assert.deepEqual(
  calculateTrainingStreak(
    [
      session({ id: 'c1', date: '2026-09-03' }),
      session({ id: 'incomplete', date: '2026-09-05', status: 'incomplete' }),
    ],
    today,
  ),
  { streak: 0, pending: false },
  'AC-B01-12: incomplete must break the streak',
)

assert.deepEqual(
  calculateTrainingStreak(
    [
      session({ id: 'c1', date: '2026-09-03' }),
      session({ id: 'c2', date: '2026-09-04' }),
      session({ id: 'extra', date: '2026-09-05', extra: true, status: 'omitted' }),
    ],
    today,
  ),
  { streak: 2, pending: false },
  'AC-B01-13: extra sessions must be neutral',
)

assert.deepEqual(
  calculateTrainingStreak(
    [
      session({ id: 'c1', date: '2026-09-03' }),
      session({ id: 'future', date: '2026-09-08', status: 'pending' }),
    ],
    today,
  ),
  { streak: 1, pending: false },
  'A not-yet-due future session must not make the current streak pending',
)

console.log('F2-B01 streak policy tests: PASS (7 scenarios)')
