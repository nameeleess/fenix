export type TrainingStreakStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'incomplete'
  | 'omitted'

export interface TrainingStreakSession {
  id: string
  createdAt: string
  deletedAt: string | null
  scheduledDate: string
  status: TrainingStreakStatus
  isFormalStrength: boolean
  isExtra: boolean
}

export interface TrainingStreakResult {
  streak: number
  pending: boolean
}

/**
 * Canonical FÉNIX training streak policy.
 *
 * Progress owns this derived statistic. Training and Today consume the same
 * result; no streak value is persisted as source data.
 */
export function calculateTrainingStreak(
  sessions: TrainingStreakSession[],
  todayKey: string,
): TrainingStreakResult {
  const formalSequence = sessions
    .filter(
      (session) =>
        session.deletedAt === null &&
        session.isFormalStrength &&
        !session.isExtra &&
        session.scheduledDate <= todayKey,
    )
    .sort((first, second) => {
      const byScheduledDate = first.scheduledDate.localeCompare(
        second.scheduledDate,
      )

      if (byScheduledDate !== 0) {
        return byScheduledDate
      }

      const byCreatedAt = first.createdAt.localeCompare(second.createdAt)

      if (byCreatedAt !== 0) {
        return byCreatedAt
      }

      return first.id.localeCompare(second.id)
    })

  let streak = 0
  let pending = false

  for (
    let index = formalSequence.length - 1;
    index >= 0;
    index -= 1
  ) {
    const session = formalSequence[index]

    if (
      session.status === 'pending' ||
      session.status === 'in_progress'
    ) {
      pending = true
      continue
    }

    if (session.status === 'completed') {
      streak += 1
      continue
    }

    // omitted / incomplete resolve the formal sequence as a break.
    break
  }

  return {
    streak,
    pending,
  }
}
