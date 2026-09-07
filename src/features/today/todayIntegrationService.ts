import { db } from '../../db/database'
import type { NutritionMealView } from '../nutrition/nutritionVNextService'
import {
  getNutritionDay,
  getRelevantNutritionMeal,
  nutritionRoleLabel,
  type MacroSummary,
} from '../nutrition/nutritionVNextService'
import {
  getActiveWorkout,
  getTrainingHome,
} from '../training/trainingService'
import {
  getProgressSummary,
  type ProgressSummary,
} from '../progress/progressService'
import type { PlannedWorkoutSession, PlannedWorkoutStatus } from '../../types/training'

export type TodayTrainingStatus =
  | 'rest'
  | PlannedWorkoutStatus

export interface TodayTrainingSessionSummary {
  id: string
  title: string
  status: PlannedWorkoutStatus
  estimatedDurationMinutes: number | null
  durationMinutes: number | null
}

export interface TodayTrainingSummary {
  status: TodayTrainingStatus
  title: string
  plannedWorkoutId: string | null
  estimatedDurationMinutes: number | null
  durationMinutes: number | null
  sessions: TodayTrainingSessionSummary[]
  sessionCount: number
  hasMultipleSessions: boolean
  completedThisWeek: number
  plannedThisWeek: number
  streak: number
  streakPending: boolean
}

export interface TodayNutritionMealSummary {
  id: string
  roleLabel: string
  role: NutritionMealView['meal']['role']
  name: string
  plannedCalories: number | null
}

export interface TodayNutritionSummary {
  nextMeal: TodayNutritionMealSummary | null
  consumed: MacroSummary
  planned: MacroSummary
  targetCalories: number | null
  targetProtein: number | null
}

export interface TodayIntegrationSummary {
  training: TodayTrainingSummary
  nutrition: TodayNutritionSummary
  progress: ProgressSummary
}

function durationMinutes(startedAt: string, endedAt: string | null | undefined) {
  if (!endedAt) {
    return null
  }

  const start = Date.parse(startedAt)
  const end = Date.parse(endedAt)

  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    return null
  }

  return Math.round((end - start) / 60000)
}

function compareTodaySessions(a: PlannedWorkoutSession, b: PlannedWorkoutSession) {
  const priority: Record<PlannedWorkoutStatus, number> = {
    in_progress: 0,
    pending: 1,
    completed: 2,
    incomplete: 2,
    omitted: 3,
  }
  const byStatus = priority[a.status] - priority[b.status]
  if (byStatus !== 0) return byStatus

  const byCreatedAt = a.createdAt.localeCompare(b.createdAt)
  if (byCreatedAt !== 0) return byCreatedAt
  return a.id.localeCompare(b.id)
}

async function sessionSummary(session: PlannedWorkoutSession): Promise<TodayTrainingSessionSummary> {
  const execution = session.executionSessionId
    ? await db.workoutSessions.get(session.executionSessionId)
    : null

  return {
    id: session.id,
    title: session.templateName,
    status: session.status,
    estimatedDurationMinutes: session.estimatedDurationMinutes,
    durationMinutes: execution
      ? durationMinutes(execution.startedAt, execution.endedAt ?? execution.completedAt)
      : null,
  }
}

async function getTodayTraining(dateKey: string): Promise<TodayTrainingSummary> {
  const [home, active] = await Promise.all([
    getTrainingHome(dateKey),
    getActiveWorkout(),
  ])

  const plannedSessions = [
    ...(home.week.find((item) => item.date === dateKey)?.sessions ?? []),
  ].sort(compareTodaySessions)
  const summaries = await Promise.all(plannedSessions.map(sessionSummary))
  const common = {
    sessions: summaries,
    sessionCount: summaries.length,
    hasMultipleSessions: summaries.length > 1,
    completedThisWeek: home.completedThisWeek,
    plannedThisWeek: home.plannedThisWeek,
    streak: home.streak,
    streakPending: home.streakPending,
  }

  if (active) {
    return {
      ...common,
      status: 'in_progress',
      title: active.template.name,
      plannedWorkoutId: active.planned?.id ?? null,
      estimatedDurationMinutes:
        active.planned?.estimatedDurationMinutes ??
        active.template.estimatedDurationMinutes ??
        null,
      durationMinutes: null,
    }
  }

  const focus = plannedSessions[0] ?? null

  if (!focus) {
    return {
      ...common,
      status: 'rest',
      title: 'Descanso programado',
      plannedWorkoutId: null,
      estimatedDurationMinutes: null,
      durationMinutes: null,
    }
  }

  const focusSummary = summaries.find((item) => item.id === focus.id) ?? null

  return {
    ...common,
    status: focus.status,
    title: focus.templateName,
    plannedWorkoutId: focus.id,
    estimatedDurationMinutes: focus.estimatedDurationMinutes,
    durationMinutes: focusSummary?.durationMinutes ?? null,
  }
}

async function getTodayNutrition(dateKey: string): Promise<TodayNutritionSummary> {
  const day = await getNutritionDay(dateKey)
  const relevant = getRelevantNutritionMeal(day)

  return {
    nextMeal: relevant
      ? {
          id: relevant.meal.id,
          roleLabel: nutritionRoleLabel(relevant.meal.role),
          role: relevant.meal.role,
          name: relevant.meal.name,
          plannedCalories: relevant.meal.plannedCalories,
        }
      : null,
    consumed: day.consumed,
    planned: day.planned,
    targetCalories: day.goal?.targetCalories ?? null,
    targetProtein: day.goal?.targetProtein ?? null,
  }
}

export async function getTodayIntegrationSummary(
  dateKey: string,
): Promise<TodayIntegrationSummary> {
  const [training, nutrition, progress] = await Promise.all([
    getTodayTraining(dateKey),
    getTodayNutrition(dateKey),
    getProgressSummary(dateKey),
  ])

  return {
    training,
    nutrition,
    progress,
  }
}
