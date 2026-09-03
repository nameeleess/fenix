import type { BaseEntity } from './common'

export type ProgressGoalKind =
  | 'weight_final'
  | 'weight_milestone'

/*
 * Registro real de peso.
 *
 * comparable=false no elimina ni
 * invalida el dato: simplemente
 * informa al motor longitudinal de
 * que debe utilizarlo con prudencia.
 */
export interface WeightEntry
  extends BaseEntity {
  date: string

  recordedAt: string

  weightKg: number

  comparable: boolean

  exceptionNote: string | null

  notes: string | null

  /*
   * BIA auxiliar.
   */
  bodyFatPercent: number | null

  fatMassKg: number | null

  muscleMassKg: number | null

  biaSource: string | null
}

export interface BodyMeasurement
  extends BaseEntity {
  date: string

  recordedAt: string

  waistCm: number | null

  rightArmCm: number | null

  leftArmCm: number | null

  notes: string | null
}

/*
 * Los objetivos tienen vigencia.
 *
 * Cambiar un objetivo futuro no
 * reescribe objetivos históricos.
 */
export interface ProgressGoal
  extends BaseEntity {
  kind: ProgressGoalKind

  targetWeightKg: number

  startsOn: string

  endsOn: string | null

  targetPeriodStart: string | null

  targetPeriodEnd: string | null

  targetPeriodLabel: string | null

  isActive: boolean

  notes: string | null
}

/*
 * Preferencia visual de Progreso.
 *
 * El ejercicio continúa perteneciendo
 * a Training.
 */
export interface ProgressFeaturedExercise
  extends BaseEntity {
  exerciseId: string

  order: number
}