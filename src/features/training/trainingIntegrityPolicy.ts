import type {
  PlannedWorkoutSession,
  PlannedWorkoutStatus,
  SetType,
} from '../../types/training'

export interface TrainingSetValues {
  weight: number | null
  reps: number | null
  rir: number | null
}

export type SetValidationMode = 'draft' | 'complete'

export function isValidTrainingDateKey(dateKey: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    return false
  }

  const parsed = new Date(`${dateKey}T00:00:00.000Z`)

  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === dateKey
}

export function assertValidTrainingDateKey(dateKey: string) {
  if (!isValidTrainingDateKey(dateKey)) {
    throw new Error('Fecha no válida.')
  }
}

export function comparePlannedWorkoutSessions(
  a: PlannedWorkoutSession,
  b: PlannedWorkoutSession,
) {
  const byDate = a.scheduledDate.localeCompare(b.scheduledDate)

  if (byDate !== 0) {
    return byDate
  }

  const byCreatedAt = a.createdAt.localeCompare(b.createdAt)

  if (byCreatedAt !== 0) {
    return byCreatedAt
  }

  return a.id.localeCompare(b.id)
}

export function assertPlannedCanStart(status: PlannedWorkoutStatus) {
  if (status !== 'pending' && status !== 'in_progress') {
    throw new Error('Esta sesión ya está resuelta.')
  }
}

export function assertPlannedPending(
  status: PlannedWorkoutStatus,
  operation: 'omit' | 'reprogram',
) {
  if (status === 'pending') {
    return
  }

  if (operation === 'omit') {
    throw new Error('Solo se puede omitir una sesión pendiente.')
  }

  throw new Error('Solo se puede reprogramar una sesión pendiente.')
}

function assertNullableFiniteNonNegative(value: number | null, label: string) {
  if (value === null) {
    return
  }

  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} no válido.`)
  }
}

export function validateSetValues(
  values: TrainingSetValues,
  setType: SetType,
  mode: SetValidationMode,
) {
  assertNullableFiniteNonNegative(values.weight, 'Peso')

  if (values.reps !== null) {
    if (!Number.isFinite(values.reps) || !Number.isInteger(values.reps) || values.reps < 0) {
      throw new Error('Repeticiones no válidas.')
    }
  }

  if (mode === 'complete' && (values.reps === null || values.reps < 1)) {
    throw new Error('Introduce al menos una repetición antes de completar la serie.')
  }

  if (setType === 'warmup') {
    if (values.rir !== null) {
      throw new Error('Las series de calentamiento no admiten RIR.')
    }

    return
  }

  if (values.rir !== null) {
    if (!Number.isFinite(values.rir) || values.rir < 0 || values.rir > 10) {
      throw new Error('RIR no válido.')
    }
  }
}
