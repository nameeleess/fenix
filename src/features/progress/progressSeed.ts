import { db } from '../../db/database'
import type { ProgressGoal } from '../../types/progress'

const PROGRESS_SEED_VERSION = '1'
const createdAt = '2026-09-03T00:00:00.000Z'

function base(id: string) {
  return {
    id,
    createdAt,
    updatedAt: createdAt,
    deletedAt: null,
    version: 1,
  }
}

const defaultGoals: ProgressGoal[] = [
  {
    ...base('progress-goal-weight-final-78'),
    kind: 'weight_final',
    targetWeightKg: 78,
    startsOn: '2026-09-03',
    endsOn: null,
    targetPeriodStart: null,
    targetPeriodEnd: null,
    targetPeriodLabel: null,
    isActive: true,
    notes: 'Objetivo final de peso vigente en FÉNIX.',
  },
  {
    ...base('progress-goal-weight-milestone-70'),
    kind: 'weight_milestone',
    targetWeightKg: 70,
    startsOn: '2026-09-03',
    endsOn: null,
    targetPeriodStart: null,
    targetPeriodEnd: null,
    targetPeriodLabel: 'inicios de octubre de 2026',
    isActive: true,
    notes: 'Hito mínimo activo; el periodo es deliberadamente aproximado.',
  },
]

export async function ensureProgressSeed() {
  const meta = await db.appMeta.get('progressSeedVersion')

  if (meta?.value === PROGRESS_SEED_VERSION) {
    return
  }

  await db.transaction('rw', db.progressGoals, db.appMeta, async () => {
    const existingGoals = await db.progressGoals.toArray()
    const activeKinds = new Set(
      existingGoals
        .filter((goal) => goal.deletedAt === null)
        .map((goal) => goal.kind),
    )

    const missing = defaultGoals.filter((goal) => !activeKinds.has(goal.kind))

    if (missing.length > 0) {
      await db.progressGoals.bulkAdd(missing)
    }

    await db.appMeta.put({
      key: 'progressSeedVersion',
      value: PROGRESS_SEED_VERSION,
      updatedAt: new Date().toISOString(),
    })
  })
}
