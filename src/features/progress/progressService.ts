import { db } from '../../db/database'
import { publishCommittedMutation } from '../../app/freshnessEvents'
import type {
  BodyMeasurement,
  ProgressFeaturedExercise,
  ProgressGoal,
  WeightEntry,
} from '../../types/progress'

import {
  getCanonicalTrainingStreak,
} from './trainingStreak'

export interface WeightTrendSummary {
  latest: WeightEntry | null
  currentMean: number | null
  previousMean: number | null
  deltaKg: number | null
  currentCount: number
  previousCount: number
  status: 'ready' | 'insufficient'
  series: WeightEntry[]
}

export interface RoutineAdherenceSummary {
  completed: number
  skipped: number
  unregistered: number
  notApplicable: number
  known: number
  adherencePercent: number | null
}

export interface TrainingAdherenceSummary {
  completed: number
  incomplete: number
  omitted: number
  unresolved: number
  known: number
  adherencePercent: number | null
  streak: number
  streakPending: boolean
}

export interface ProgressSummary {
  weight: WeightTrendSummary
  routine: RoutineAdherenceSummary
  training: TrainingAdherenceSummary
  goals: ProgressGoal[]
  insight: string | null
}

function entityBase() {
  const now = new Date().toISOString()

  return {
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    version: 1,
  }
}

export function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function shiftDateKey(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T12:00:00`)
  date.setDate(date.getDate() + days)
  return getLocalDateKey(date)
}

function mean(values: number[]) {
  if (values.length === 0) {
    return null
  }

  return values.reduce((total, value) => total + value, 0) / values.length
}

function round(value: number, decimals = 2) {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

function latestComparablePerDate(entries: WeightEntry[]) {
  const byDate = new Map<string, WeightEntry>()

  for (const entry of entries) {
    if (entry.deletedAt !== null || !entry.comparable) {
      continue
    }

    const existing = byDate.get(entry.date)

    if (!existing || Date.parse(entry.recordedAt) > Date.parse(existing.recordedAt)) {
      byDate.set(entry.date, entry)
    }
  }

  return [...byDate.values()].sort(
    (a, b) => Date.parse(a.recordedAt) - Date.parse(b.recordedAt),
  )
}

export async function getWeightTrendSummary(
  todayKey = getLocalDateKey(),
): Promise<WeightTrendSummary> {
  const allEntries = (await db.weightEntries.toArray())
    .filter((entry) => entry.deletedAt === null)
    .sort((a, b) => Date.parse(a.recordedAt) - Date.parse(b.recordedAt))

  const latest = allEntries.at(-1) ?? null
  const comparable = latestComparablePerDate(allEntries)

  const currentStart = shiftDateKey(todayKey, -6)
  const previousStart = shiftDateKey(todayKey, -13)
  const previousEnd = shiftDateKey(todayKey, -7)
  const seriesStart = shiftDateKey(todayKey, -27)

  const current = comparable.filter(
    (entry) => entry.date >= currentStart && entry.date <= todayKey,
  )

  const previous = comparable.filter(
    (entry) => entry.date >= previousStart && entry.date <= previousEnd,
  )

  const currentMeanRaw = mean(current.map((entry) => entry.weightKg))
  const previousMeanRaw = mean(previous.map((entry) => entry.weightKg))

  const ready = current.length >= 3 && previous.length >= 3

  return {
    latest,
    currentMean: current.length >= 3 && currentMeanRaw !== null
      ? round(currentMeanRaw)
      : null,
    previousMean: previous.length >= 3 && previousMeanRaw !== null
      ? round(previousMeanRaw)
      : null,
    deltaKg:
      ready && currentMeanRaw !== null && previousMeanRaw !== null
        ? round(currentMeanRaw - previousMeanRaw)
        : null,
    currentCount: current.length,
    previousCount: previous.length,
    status: ready ? 'ready' : 'insufficient',
    series: comparable.filter((entry) => entry.date >= seriesStart),
  }
}

export async function getRoutineAdherenceSummary(
  todayKey = getLocalDateKey(),
): Promise<RoutineAdherenceSummary> {
  const start = shiftDateKey(todayKey, -6)
  const tasks = (await db.dailyRoutineTasks.toArray()).filter(
    (task) =>
      task.deletedAt === null &&
      task.date >= start &&
      task.date <= todayKey,
  )

  let completed = 0
  let skipped = 0
  let unregistered = 0
  let notApplicable = 0

  for (const task of tasks) {
    if (task.status === 'completed') {
      completed += 1
      continue
    }

    if (task.status === 'skipped') {
      skipped += 1
      continue
    }

    if (task.status === 'not_applicable') {
      notApplicable += 1
      continue
    }

    if (task.status === 'pending' && task.date < todayKey) {
      unregistered += 1
    }
  }

  const known = completed + skipped

  return {
    completed,
    skipped,
    unregistered,
    notApplicable,
    known,
    adherencePercent: known > 0 ? Math.round((completed / known) * 100) : null,
  }
}

export async function getTrainingAdherenceSummary(
  todayKey = getLocalDateKey(),
): Promise<TrainingAdherenceSummary> {
  const start = shiftDateKey(todayKey, -27)
  const sessions = (await db.plannedWorkoutSessions.toArray())
    .filter(
      (session) =>
        session.deletedAt === null &&
        session.isFormalStrength &&
        !session.isExtra &&
        session.scheduledDate >= start &&
        session.scheduledDate <= todayKey,
    )
    .sort((a, b) => {
      if (a.scheduledDate === b.scheduledDate) {
        return a.createdAt.localeCompare(b.createdAt)
      }

      return a.scheduledDate.localeCompare(b.scheduledDate)
    })

  const streakInfo = await getCanonicalTrainingStreak(todayKey)

  let completed = 0
  let incomplete = 0
  let omitted = 0
  let unresolved = 0

  for (const session of sessions) {
    if (session.status === 'completed') {
      completed += 1
    } else if (session.status === 'incomplete') {
      incomplete += 1
    } else if (session.status === 'omitted') {
      omitted += 1
    } else {
      unresolved += 1
    }
  }

  const known = completed + incomplete + omitted


  return {
    completed,
    incomplete,
    omitted,
    unresolved,
    known,
    adherencePercent: known > 0 ? Math.round((completed / known) * 100) : null,
    streak: streakInfo.streak,
    streakPending: streakInfo.pending,
  }
}

export async function getActiveProgressGoals() {
  const goals = await db.progressGoals.toArray()

  return goals
    .filter((goal) => goal.deletedAt === null && goal.isActive)
    .sort((a, b) => a.targetWeightKg - b.targetWeightKg)
}

export async function getProgressSummary(
  todayKey = getLocalDateKey(),
): Promise<ProgressSummary> {
  const [weight, routine, training, goals] = await Promise.all([
    getWeightTrendSummary(todayKey),
    getRoutineAdherenceSummary(todayKey),
    getTrainingAdherenceSummary(todayKey),
    getActiveProgressGoals(),
  ])

  let insight: string | null = null

  if (!weight.latest) {
    insight = 'Registra tu primer peso para empezar a construir una tendencia útil.'
  } else if (weight.status === 'insufficient') {
    insight = 'Todavía faltan registros comparables para calcular una tendencia semanal fiable.'
  } else if (routine.unregistered > routine.known && routine.unregistered > 0) {
    insight = 'Hay más tareas históricas sin registrar que resultados conocidos; la adherencia necesita más cobertura.'
  } else if (training.unresolved > 0) {
    insight = 'Hay sesiones planificadas pendientes de resolver; la racha todavía no puede interpretarse con certeza.'
  }

  return {
    weight,
    routine,
    training,
    goals,
    insight,
  }
}

export async function addWeightEntry(input: {
  weightKg: number
  comparable: boolean
  recordedAt?: string
  exceptionNote?: string | null
  notes?: string | null
  bodyFatPercent?: number | null
  fatMassKg?: number | null
  muscleMassKg?: number | null
  biaSource?: string | null
}) {
  if (!Number.isFinite(input.weightKg) || input.weightKg <= 0) {
    throw new Error('Introduce un peso válido.')
  }

  const recordedAt = input.recordedAt ?? new Date().toISOString()
  const date = getLocalDateKey(new Date(recordedAt))

  const entry: WeightEntry = {
    ...entityBase(),
    date,
    recordedAt,
    weightKg: round(input.weightKg, 2),
    comparable: input.comparable,
    exceptionNote: input.exceptionNote?.trim() || null,
    notes: input.notes?.trim() || null,
    bodyFatPercent: input.bodyFatPercent ?? null,
    fatMassKg: input.fatMassKg ?? null,
    muscleMassKg: input.muscleMassKg ?? null,
    biaSource: input.biaSource?.trim() || null,
  }

  await db.weightEntries.add(entry)
  publishCommittedMutation('progress')
  return entry
}

export async function getWeightHistory() {
  const entries = await db.weightEntries.toArray()

  return entries
    .filter((entry) => entry.deletedAt === null)
    .sort((a, b) => Date.parse(b.recordedAt) - Date.parse(a.recordedAt))
}

export async function updateWeightEntry(
  id: string,
  patch: Partial<Pick<
    WeightEntry,
    | 'weightKg'
    | 'recordedAt'
    | 'comparable'
    | 'exceptionNote'
    | 'notes'
    | 'bodyFatPercent'
    | 'fatMassKg'
    | 'muscleMassKg'
    | 'biaSource'
  >>,
) {
  const current = await db.weightEntries.get(id)

  if (!current) {
    throw new Error('Registro de peso no encontrado.')
  }

  const recordedAt = patch.recordedAt ?? current.recordedAt

  await db.weightEntries.update(id, {
    ...patch,
    date: getLocalDateKey(new Date(recordedAt)),
    updatedAt: new Date().toISOString(),
    version: current.version + 1,
  })

  publishCommittedMutation('progress')
}

export async function deleteWeightEntry(id: string) {
  const current = await db.weightEntries.get(id)

  if (!current) {
    return
  }

  await db.weightEntries.update(id, {
    deletedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: current.version + 1,
  })

  publishCommittedMutation('progress')
}

export async function addBodyMeasurement(input: {
  waistCm: number | null
  rightArmCm: number | null
  leftArmCm: number | null
  notes?: string | null
  recordedAt?: string
}) {
  const values = [input.waistCm, input.rightArmCm, input.leftArmCm].filter(
    (value): value is number => value !== null,
  )

  if (values.length === 0) {
    throw new Error('Introduce al menos una medida corporal.')
  }

  if (values.some((value) => !Number.isFinite(value) || value <= 0)) {
    throw new Error('Introduce medidas válidas.')
  }

  const recordedAt = input.recordedAt ?? new Date().toISOString()

  const measurement: BodyMeasurement = {
    ...entityBase(),
    date: getLocalDateKey(new Date(recordedAt)),
    recordedAt,
    waistCm: input.waistCm,
    rightArmCm: input.rightArmCm,
    leftArmCm: input.leftArmCm,
    notes: input.notes?.trim() || null,
  }

  await db.bodyMeasurements.add(measurement)
  publishCommittedMutation('progress')
  return measurement
}

export async function getBodyMeasurements() {
  const items = await db.bodyMeasurements.toArray()

  return items
    .filter((item) => item.deletedAt === null)
    .sort((a, b) => Date.parse(b.recordedAt) - Date.parse(a.recordedAt))
}

export async function deleteBodyMeasurement(id: string) {
  const current = await db.bodyMeasurements.get(id)

  if (!current) {
    return
  }

  await db.bodyMeasurements.update(id, {
    deletedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: current.version + 1,
  })

  publishCommittedMutation('progress')
}

export async function getFeaturedExerciseOptions() {
  const [exercises, featured] = await Promise.all([
    db.exercises.toArray(),
    db.progressFeaturedExercises.toArray(),
  ])

  const activeFeatured = featured
    .filter((item) => item.deletedAt === null)
    .sort((a, b) => a.order - b.order)

  const selected = new Set(activeFeatured.map((item) => item.exerciseId))

  return exercises
    .filter((exercise) => exercise.deletedAt === null)
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
    .map((exercise) => ({
      exercise,
      selected: selected.has(exercise.id),
    }))
}

export async function setFeaturedExercises(exerciseIds: string[]) {
  const uniqueIds = [...new Set(exerciseIds)].slice(0, 5)
  const current = await db.progressFeaturedExercises.toArray()
  const now = new Date().toISOString()

  await db.transaction('rw', db.progressFeaturedExercises, async () => {
    for (const item of current) {
      if (item.deletedAt === null) {
        await db.progressFeaturedExercises.update(item.id, {
          deletedAt: now,
          updatedAt: now,
          version: item.version + 1,
        })
      }
    }

    const next: ProgressFeaturedExercise[] = uniqueIds.map((exerciseId, index) => ({
      ...entityBase(),
      exerciseId,
      order: index + 1,
    }))

    if (next.length > 0) {
      await db.progressFeaturedExercises.bulkAdd(next)
    }
  })

  publishCommittedMutation('progress')
}

export async function getFeaturedExercisePerformance() {
  const [featured, exercises, sessions, sets] = await Promise.all([
    db.progressFeaturedExercises.toArray(),
    db.exercises.toArray(),
    db.workoutSessions.toArray(),
    db.exerciseSets.toArray(),
  ])

  const exerciseMap = new Map(
    exercises
      .filter((exercise) => exercise.deletedAt === null)
      .map((exercise) => [exercise.id, exercise]),
  )

  const sessionMap = new Map(
    sessions
      .filter(
        (session) =>
          session.deletedAt === null &&
          (session.status === 'completed' || session.status === 'incomplete'),
      )
      .map((session) => [session.id, session]),
  )

  return featured
    .filter((item) => item.deletedAt === null)
    .sort((a, b) => a.order - b.order)
    .map((item) => {
      const exercise = exerciseMap.get(item.exerciseId)
      const completedSets = sets
        .filter(
          (set) =>
            set.deletedAt === null &&
            set.exerciseId === item.exerciseId &&
            set.setType === 'working' &&
            set.completedAt !== null &&
            sessionMap.has(set.workoutSessionId),
        )
        .sort((a, b) => Date.parse(b.completedAt ?? '') - Date.parse(a.completedAt ?? ''))

      return {
        exercise: exercise ?? null,
        latestSet: completedSets[0] ?? null,
        comparisonStatus: 'unknown' as const,
      }
    })
    .filter((item) => item.exercise !== null)
}
