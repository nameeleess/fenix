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

export type ExerciseTolerance =
  | 'no_issues'
  | 'occasional_discomfort'
  | 'avoid_for_now'

export interface Exercise
  extends BaseEntity {
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
   *
   * Se conserva temporalmente para
   * no destruir ni invalidar los
   * ejercicios ya existentes.
   *
   * Training vNext no debe utilizar
   * este campo como indicador de
   * seguridad clínica.
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

export interface WorkoutTemplate
  extends BaseEntity {
  name: string

  dayOfWeek: number | null

  type: WorkoutType

  description: string | null

  estimatedDurationMinutes?: number | null

  isFormalStrength?: boolean
}

export interface WorkoutTemplateExercise
  extends BaseEntity {
  workoutTemplateId: string

  exerciseId: string

  order: number

  targetSets: number

  minReps: number

  maxReps: number

  /*
   * Campo histórico actual.
   */
  targetRir: number | null

  /*
   * vNext permite representar un
   * objetivo de RIR como rango sin
   * romper las plantillas actuales.
   */
  targetRirMin?: number | null

  targetRirMax?: number | null

  restSeconds: number

  referenceWeight: number | null

  alternativeExerciseIds?: string[]

  supersetGroupId?: string | null
}

/*
 * Identidad estable de una sesión
 * programada.
 *
 * Existe antes de comenzar a entrenar,
 * por lo que Nutrition puede asociar
 * Pre/Post a esta identidad.
 *
 * Reprogramar modifica scheduledDate,
 * nunca el id.
 */
export type PlannedWorkoutStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'incomplete'
  | 'omitted'

export interface PlannedWorkoutSession
  extends BaseEntity {
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

/*
 * Ejecución real.
 *
 * Se mantiene separada de la
 * programación para no confundir
 * "debía entrenar" con
 * "esto fue lo que ocurrió".
 */
export type WorkoutSessionStatus =
  | 'active'
  | 'completed'
  | 'incomplete'
  | 'cancelled'

export interface WorkoutSession
  extends BaseEntity {
  workoutTemplateId: string

  templateName: string

  status: WorkoutSessionStatus

  /*
   * null en sesiones legacy o extras
   * que todavía no estén vinculadas.
   */
  plannedWorkoutId?: string | null

  startedAt: string

  completedAt: string | null

  endedAt?: string | null

  notes: string | null
}

/*
 * Snapshot del ejercicio utilizado
 * realmente dentro de una sesión.
 *
 * Permite que editar mañana una
 * plantilla no reescriba el pasado.
 */
export interface WorkoutSessionExercise
  extends BaseEntity {
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
}

export interface ExerciseSet
  extends BaseEntity {
  workoutSessionId: string

  /*
   * Las series históricas actuales no
   * disponen todavía de esta relación.
   *
   * Las sesiones vNext sí podrán
   * utilizarla.
   */
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