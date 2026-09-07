import { db } from '../../db/database'
import {
  calculateTrainingStreak,
  type TrainingStreakResult,
} from './trainingStreakPolicy'

export async function getCanonicalTrainingStreak(
  todayKey: string,
): Promise<TrainingStreakResult> {
  const sessions = await db.plannedWorkoutSessions.toArray()

  return calculateTrainingStreak(
    sessions,
    todayKey,
  )
}
