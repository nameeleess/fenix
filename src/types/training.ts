export type SetType = 'warmup' | 'working'

export type WorkoutType = 'upper' | 'lower' | 'core' | 'mobility'

export interface BaseEntity {
  id: string
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  version: number
}

export interface Exercise extends BaseEntity {
  name: string
  primaryMuscle: string
  secondaryMuscles: string[]
  equipment: string
  exerciseType: 'compound' | 'isolation' | 'core' | 'mobility'
  spineLoad: 'low' | 'moderate' | 'high'
  techniqueNotes: string | null

  // Preparado para las demostraciones visuales.
  mediaPath: string | null
  mediaType: 'gif' | 'video' | 'image' | null
}

export interface WorkoutTemplate extends BaseEntity {
  name: string
  dayOfWeek: number | null
  type: WorkoutType
  description: string | null
}

export interface WorkoutTemplateExercise extends BaseEntity {
  workoutTemplateId: string
  exerciseId: string
  order: number
  targetSets: number
  minReps: number
  maxReps: number
  targetRir: number | null
  restSeconds: number
  referenceWeight: number | null
}

export type WorkoutSessionStatus = 'active' | 'completed' | 'cancelled'

export interface WorkoutSession extends BaseEntity {
  workoutTemplateId: string
  templateName: string
  status: WorkoutSessionStatus
  startedAt: string
  completedAt: string | null
  notes: string | null
}

export interface ExerciseSet extends BaseEntity {
  workoutSessionId: string
  exerciseId: string
  exerciseName: string
  order: number
  setType: SetType

  weight: number | null
  reps: number | null
  rir: number | null

  completedAt: string | null
}