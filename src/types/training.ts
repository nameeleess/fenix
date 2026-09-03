import type { BaseEntity } from './common'

export type { BaseEntity } from './common'

export type SetType =
  | 'warmup'
  | 'working'

export type WorkoutType =
  | 'upper'
  | 'lower'
  | 'core'
  | 'mobility'
  | 'recovery'

export type ExerciseTolerance =
  | 'no_issues'
  | 'occasional_discomfort'
  | 'avoid_for_now'

export interface Exercise extends BaseEntity {
  name: string
  primaryMuscle: string
  secondaryMuscles: string[]
  equipment: string
  exerciseType:
    | 'compound'
    | 'isolation'
    | 'core'
    | 'mobility'

  /*
   * LEGACY.
   * Se conserva para no invalidar datos previos.
   * Training vNext no lo presenta como indicador clínico.
   */
  spineLoad:
    | 'low'
    | 'moderate'
    | 'high'

  tolerance?: ExerciseTolerance | null
  personalNotes?: string | null
  techniqueNotes: string | null
  mediaPath: string | null
  mediaType:
    | 'gif'
    | 'video'
    | 'image'
    | null
}

export interface WorkoutTemplate extends BaseEntity {
  name: string
  dayOfWeek: number | null
  type: WorkoutType
  description: string | null
  estimatedDurationMinutes?: number | null
  isFormalStrength?: boolean
}

export interface WorkoutTemplateExercise extends BaseEntity {
  workoutTemplateId: string
  exerciseId: string
  order: number
  targetSets: number
  minReps: number
  maxReps: number
  targetRir: number | null
  targetRirMin?: number | null
  targetRirMax?: number | null
  restSeconds: number
  referenceWeight: number | null
  alternativeExerciseIds?: string[]
  supersetGroupId?: string | null
  targetSeconds?: number | null
}

export type PlannedWorkoutStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'incomplete'
  | 'omitted'

export interface PlannedWorkoutSession extends BaseEntity {
  workoutTemplateId: string
  templateName: string
  originalScheduledDate: string
  scheduledDate: string
  status: PlannedWorkoutStatus
  executionSessionId: string | null
  isFormalStrength: boolean
  isExtra: boolean
  estimatedDurationMinutes: number | null
  rescheduleCount: number
  resolvedAt: string | null
  notes: string | null
}

export type WorkoutSessionStatus =
  | 'active'
  | 'completed'
  | 'incomplete'
  | 'cancelled'

export interface WorkoutSession extends BaseEntity {
  workoutTemplateId: string
  templateName: string
  status: WorkoutSessionStatus
  plannedWorkoutId?: string | null
  startedAt: string
  completedAt: string | null
  endedAt?: string | null
  notes: string | null
}

export interface WorkoutSessionExercise extends BaseEntity {
  workoutSessionId: string
  sourceTemplateExerciseId: string | null
  exerciseId: string
  exerciseName: string
  order: number
  targetSets: number
  minReps: number
  maxReps: number
  targetRirMin: number | null
  targetRirMax: number | null
  restSeconds: number
  substitutedFromExerciseId: string | null
  notes: string | null
  targetSeconds?: number | null
}

export interface ExerciseSet extends BaseEntity {
  workoutSessionId: string
  workoutSessionExerciseId?: string | null
  exerciseId: string
  exerciseName: string
  order: number
  setType: SetType
  weight: number | null
  reps: number | null
  rir: number | null
  completedAt: string | null
}
