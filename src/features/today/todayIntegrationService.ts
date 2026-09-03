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
import type { PlannedWorkoutStatus } from '../../types/training'

export type TodayTrainingStatus =
  | 'rest'
  | PlannedWorkoutStatus

export interface TodayTrainingSummary {
  status: TodayTrainingStatus
  title: string
  plannedWorkoutId: string | null
  estimatedDurationMinutes: number | null
  durationMinutes: number | null
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

async function getTodayTraining(dateKey: string): Promise<TodayTrainingSummary> {
  const [home, active] = await Promise.all([
    getTrainingHome(dateKey),
    getActiveWorkout(),
  ])

  if (active) {
    return {
      status: 'in_progress',
      title: active.template.name,
      plannedWorkoutId: active.planned?.id ?? null,
      estimatedDurationMinutes:
        active.planned?.estimatedDurationMinutes ??
        active.template.estimatedDurationMinutes ??
        null,
      durationMinutes: null,
      completedThisWeek: home.completedThisWeek,
      plannedThisWeek: home.plannedThisWeek,
      streak: home.streak,
      streakPending: home.streakPending,
    }
  }

  const todayPlanned =
    home.week.find((item) => item.date === dateKey)?.session ?? null

  if (!todayPlanned) {
    return {
      status: 'rest',
      title: 'Descanso programado',
      plannedWorkoutId: null,
      estimatedDurationMinutes: null,
      durationMinutes: null,
      completedThisWeek: home.completedThisWeek,
      plannedThisWeek: home.plannedThisWeek,
      streak: home.streak,
      streakPending: home.streakPending,
    }
  }

  const execution = todayPlanned.executionSessionId
    ? await db.workoutSessions.get(todayPlanned.executionSessionId)
    : null

  return {
    status: todayPlanned.status,
    title: todayPlanned.templateName,
    plannedWorkoutId: todayPlanned.id,
    estimatedDurationMinutes: todayPlanned.estimatedDurationMinutes,
    durationMinutes: execution
      ? durationMinutes(
          execution.startedAt,
          execution.endedAt ?? execution.completedAt,
        )
      : null,
    completedThisWeek: home.completedThisWeek,
    plannedThisWeek: home.plannedThisWeek,
    streak: home.streak,
    streakPending: home.streakPending,
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
    getProgressSummary(),
  ])

  return {
    training,
    nutrition,
    progress,
  }
}
