import { db } from '../../db/database'
import { publishCommittedMutation } from '../../app/freshnessEvents'
import { assertValidTrainingDateKey } from './trainingIntegrityPolicy'
import type { Exercise, WorkoutTemplate, WorkoutTemplateExercise } from '../../types/training'

export interface RoutineDraft {
  name: string
  type: WorkoutTemplate['type']
  description: string
  estimatedDurationMinutes: number | null
  isFormalStrength: boolean
}
export interface RoutineItemDraft {
  id: string
  version: number | null
  exerciseId: string
  targetSets: number
  minReps: number
  maxReps: number
  targetRirMin: number | null
  targetRirMax: number | null
  restSeconds: number
}
export interface ExerciseDraft {
  name: string
  primaryMuscle: string
  equipment: string
  exerciseType: Exercise['exerciseType']
  techniqueNotes: string
}
function base(id: string) {
  const now = new Date().toISOString()
  return { id, createdAt: now, updatedAt: now, deletedAt: null, version: 1 }
}
export function assertEditorVersion(actual: number, expected: number | null) {
  if (actual !== expected) throw new Error('El registro ha cambiado. Cierra y vuelve a abrir el editor antes de guardar.')
}
function text(value: string, label: string) {
  if (!value.trim()) throw new Error(label + ' es obligatorio.')
  return value.trim()
}
function integer(value: number, min: number, max: number, label: string) {
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(label + ' fuera de rango.')
}
function validateItem(item: RoutineItemDraft) {
  integer(item.targetSets, 1, 100, 'Series')
  integer(item.minReps, 1, 1000, 'Repeticiones mínimas')
  integer(item.maxReps, item.minReps, 1000, 'Repeticiones máximas')
  integer(item.restSeconds, 0, 3600, 'Descanso')
  for (const rir of [item.targetRirMin, item.targetRirMax]) {
    if (rir !== null && (!Number.isFinite(rir) || rir < 0 || rir > 10)) throw new Error('RIR fuera de rango.')
  }
  if (item.targetRirMin !== null && item.targetRirMax !== null && item.targetRirMin > item.targetRirMax) throw new Error('Rango RIR invertido.')
}

// Snapshot versions cover the whole definition, including removed rows.
// Execution snapshots and historical records are deliberately not in this transaction.
export async function saveRoutineDefinition(id: string, expectedVersion: number | null, draft: RoutineDraft, items: RoutineItemDraft[], original: Array<{ id: string; version: number }>) {
  const name = text(draft.name, 'Nombre')
  if (!['upper', 'lower', 'core', 'mobility', 'recovery'].includes(draft.type)) throw new Error('Tipo de rutina inválido.')
  if (draft.estimatedDurationMinutes !== null) integer(draft.estimatedDurationMinutes, 1, 1440, 'Duración')
  if (!items.length) throw new Error('Añade al menos un ejercicio.')
  if (new Set(items.map(item => item.id)).size !== items.length) throw new Error('Identificadores de fila duplicados.')
  items.forEach(validateItem)

  await db.transaction('rw', db.workoutTemplates, db.workoutTemplateExercises, db.exercises, async () => {
    const current = await db.workoutTemplates.get(id)
    if (expectedVersion === null) {
      if (current) throw new Error('Esta rutina ya se guardó. Actualiza la lista.')
    } else {
      if (!current || current.deletedAt !== null) throw new Error('Rutina no disponible.')
      assertEditorVersion(current.version, expectedVersion)
    }
    const configs = (await db.workoutTemplateExercises.where('workoutTemplateId').equals(id).toArray()).filter(item => item.deletedAt === null)
    if (configs.length !== original.length || configs.some(item => !original.some(row => row.id === item.id && row.version === item.version))) throw new Error('Los ejercicios de la rutina han cambiado. Reabre el editor.')
    for (const item of items) {
      const exercise = await db.exercises.get(item.exerciseId)
      if (!exercise || exercise.deletedAt !== null) throw new Error('Uno de los ejercicios ya no está disponible.')
      const config = configs.find(row => row.id === item.id)
      if (item.version !== null && (!config || config.version !== item.version)) throw new Error('Configuración obsoleta.')
      if (item.version === null && await db.workoutTemplateExercises.get(item.id)) throw new Error('La fila ya existe.')
    }
    const now = new Date().toISOString()
    const template = {
      ...(current ?? base(id)), name, type: draft.type,
      description: draft.description.trim() || null,
      estimatedDurationMinutes: draft.estimatedDurationMinutes,
      isFormalStrength: draft.isFormalStrength,
      dayOfWeek: current?.dayOfWeek ?? null,
      updatedAt: now, version: current ? current.version + 1 : 1,
    }
    await db.workoutTemplates.put(template)
    for (const config of configs) {
      if (!items.some(item => item.id === config.id)) await db.workoutTemplateExercises.update(config.id, { deletedAt: now, updatedAt: now, version: config.version + 1 })
    }
    for (const [index, item] of items.entries()) {
      const old = configs.find(row => row.id === item.id)
      const next: WorkoutTemplateExercise = {
        ...(old ?? base(item.id)), workoutTemplateId: id, exerciseId: item.exerciseId,
        order: index + 1, targetSets: item.targetSets, minReps: item.minReps, maxReps: item.maxReps,
        targetRir: item.targetRirMin, targetRirMin: item.targetRirMin, targetRirMax: item.targetRirMax,
        restSeconds: item.restSeconds, referenceWeight: old?.referenceWeight ?? null,
        updatedAt: now, version: old ? old.version + 1 : 1,
      }
      await db.workoutTemplateExercises.put(next)
    }
  })
  publishCommittedMutation('training')
}

export function isCustomExercise(exercise: Exercise) { return exercise.id.startsWith('custom-exercise-') }

export async function saveCustomExercise(id: string, expectedVersion: number | null, draft: ExerciseDraft) {
  if (!id.startsWith('custom-exercise-')) throw new Error('Solo se pueden editar definiciones de ejercicios propios.')
  const name = text(draft.name, 'Nombre')
  const primaryMuscle = text(draft.primaryMuscle, 'Grupo muscular')
  const equipment = text(draft.equipment, 'Equipo')
  if (!['compound', 'isolation', 'core', 'mobility'].includes(draft.exerciseType)) throw new Error('Tipo de ejercicio inválido.')
  await db.transaction('rw', db.exercises, async () => {
    const current = await db.exercises.get(id)
    if (expectedVersion === null) {
      if (current) throw new Error('Este ejercicio ya se guardó. Actualiza la lista.')
    } else {
      if (!current || current.deletedAt !== null) throw new Error('Ejercicio no disponible.')
      assertEditorVersion(current.version, expectedVersion)
    }
    const next: Exercise = {
      ...(current ?? { ...base(id), secondaryMuscles: [], spineLoad: 'low', mediaPath: null, mediaType: null }),
      name, primaryMuscle, equipment, exerciseType: draft.exerciseType,
      techniqueNotes: draft.techniqueNotes.trim() || null,
      updatedAt: new Date().toISOString(), version: current ? current.version + 1 : 1,
    }
    await db.exercises.put(next)
  })
  publishCommittedMutation('training')
}

// A request owns one UUID; dates are not unique keys. Retrying the same
// request cannot duplicate a session, while a new request on the same day can.
export async function planWorkout(id: string, templateId: string, expectedVersion: number, date: string) {
  assertValidTrainingDateKey(date)
  await db.transaction('rw', db.workoutTemplates, db.workoutTemplateExercises, db.plannedWorkoutSessions, async () => {
    const existing = await db.plannedWorkoutSessions.get(id)
    if (existing) {
      if (existing.workoutTemplateId === templateId && existing.originalScheduledDate === date) return
      throw new Error('La solicitud de planificación ya se utilizó.')
    }
    const template = await db.workoutTemplates.get(templateId)
    if (!template || template.deletedAt !== null) throw new Error('Rutina no disponible.')
    assertEditorVersion(template.version, expectedVersion)
    const configs = await db.workoutTemplateExercises.where('workoutTemplateId').equals(templateId).toArray()
    if (!configs.some(item => item.deletedAt === null)) throw new Error('La rutina no tiene ejercicios.')
    await db.plannedWorkoutSessions.add({
      ...base(id), workoutTemplateId: templateId, templateName: template.name,
      originalScheduledDate: date, scheduledDate: date, status: 'pending', executionSessionId: null,
      isFormalStrength: template.isFormalStrength === true, isExtra: false,
      estimatedDurationMinutes: template.estimatedDurationMinutes ?? null,
      rescheduleCount: 0, resolvedAt: null, notes: null,
    })
  })
  publishCommittedMutation('training')
}
