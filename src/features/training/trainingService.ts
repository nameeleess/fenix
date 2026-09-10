import { db } from '../../db/database'
import { formatWeekdayShort, getLocalDateKey, parseDateKey, shiftDateKey, startOfWeek } from '../../utils/date'
import { createUuid } from '../../utils/uuid'
export { getLocalDateKey } from '../../utils/date'
import { publishCommittedMutation } from '../../app/freshnessEvents'
import type {
  Exercise,
  ExerciseSet,
  ExerciseTolerance,
  PlannedWorkoutSession,
  SetType,
  WorkoutSession,
  WorkoutSessionExercise,
  WorkoutTemplate,
  WorkoutTemplateExercise,
} from '../../types/training'

import {
  getCanonicalTrainingStreak,
} from '../progress/trainingStreak'
import {
  assertPlannedCanStart,
  assertPlannedPending,
  assertValidTrainingDateKey,
  comparePlannedWorkoutSessions,
  validateSetValues,
  type TrainingSetValues,
} from './trainingIntegrityPolicy'

export interface TemplateExerciseView {
  config: WorkoutTemplateExercise
  exercise: Exercise
}

export interface TrainingTemplateView {
  template: WorkoutTemplate
  exercises: TemplateExerciseView[]
  totalSets: number
}

export interface TrainingWeekDayView {
  date: string
  weekdayLabel: string
  dayNumber: number
  sessions: PlannedWorkoutSession[]
  session: PlannedWorkoutSession | null
}

export interface TrainingHomeView {
  todayKey: string
  week: TrainingWeekDayView[]
  focusSession: PlannedWorkoutSession | null
  nextSession: PlannedWorkoutSession | null
  actionableSessions: PlannedWorkoutSession[]
  focusTemplate: TrainingTemplateView | null
  completedThisWeek: number
  plannedThisWeek: number
  unresolvedPast: number
  streak: number
  streakPending: boolean
  mobilityTemplate: TrainingTemplateView | null
  recoveryTemplate: TrainingTemplateView | null
}

export interface ActiveExerciseView {
  snapshot: WorkoutSessionExercise
  exercise: Exercise
  sets: ExerciseSet[]
  previousSets: ExerciseSet[]
  progressionHint: string
}

export interface ActiveSessionView {
  session: WorkoutSession
  planned: PlannedWorkoutSession | null
  template: WorkoutTemplate
  exercises: ActiveExerciseView[]
  restEndsAt: string | null
  completedWorkingSets: number
  totalWorkingSets: number
}

export interface HistorySessionView {
  session: WorkoutSession
  planned: PlannedWorkoutSession | null
  sets: ExerciseSet[]
  exercises: WorkoutSessionExercise[]
}

export interface TrainingHistoryView {
  sessions: HistorySessionView[]
}

export type SetValues = TrainingSetValues

function nowIso() {
  return new Date().toISOString()
}

function createEntityBase(id: string = createUuid()) {
  const now = nowIso()

  return {
    id,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    version: 1,
  }
}

function roundLoad(value: number) {
  return Math.round(value * 2) / 2
}

function restTimerKey(sessionId: string) {
  return `trainingRestTimer:${sessionId}`
}

async function getTemplateExercises(
  workoutTemplateId: string,
): Promise<TemplateExerciseView[]> {
  const configs = (await db.workoutTemplateExercises
    .where('workoutTemplateId')
    .equals(workoutTemplateId)
    .toArray())
    .filter((config) => config.deletedAt === null)
    .sort((a, b) => a.order - b.order)

  const result: TemplateExerciseView[] = []

  for (const config of configs) {
    const exercise = await db.exercises.get(config.exerciseId)

    if (!exercise || exercise.deletedAt !== null) {
      continue
    }

    result.push({
      config,
      exercise,
    })
  }

  return result
}

export async function getTrainingTemplates(): Promise<TrainingTemplateView[]> {
  const templates = (await db.workoutTemplates.toArray())
    .filter((template) => template.deletedAt === null)
    .sort((a, b) => {
      if (a.isFormalStrength !== b.isFormalStrength) {
        return a.isFormalStrength ? -1 : 1
      }

      const dayA = a.dayOfWeek ?? 99
      const dayB = b.dayOfWeek ?? 99
      return dayA - dayB
    })

  const result: TrainingTemplateView[] = []

  for (const template of templates) {
    const exercises = await getTemplateExercises(template.id)

    result.push({
      template,
      exercises,
      totalSets: exercises.reduce(
        (sum, item) => sum + item.config.targetSets,
        0,
      ),
    })
  }

  return result
}


export async function getPlannedWorkoutSessionsForDate(dateKey: string) {
  assertValidTrainingDateKey(dateKey)

  return (await db.plannedWorkoutSessions
    .where('scheduledDate')
    .equals(dateKey)
    .toArray())
    .filter((session) => session.deletedAt === null)
    .sort(comparePlannedWorkoutSessions)
}

export async function getTrainingHome(
  todayKey = getLocalDateKey(),
): Promise<TrainingHomeView> {
  const [templates, planned, streakInfo] = await Promise.all([
    getTrainingTemplates(),
    db.plannedWorkoutSessions.toArray(),
    getCanonicalTrainingStreak(todayKey),
  ])

  const activePlanned = planned
    .filter(
      (session) =>
        session.deletedAt === null &&
        session.isFormalStrength &&
        !session.isExtra,
    )
    .sort(comparePlannedWorkoutSessions)

  const monday = startOfWeek(todayKey)
  const weekDates = Array.from({ length: 7 }, (_, index) =>
    shiftDateKey(monday, index),
  )

  const week: TrainingWeekDayView[] = weekDates.map((date) => {
    const sessions = activePlanned
      .filter((item) => item.scheduledDate === date)
      .sort(comparePlannedWorkoutSessions)

    return {
      date,
      weekdayLabel: formatWeekdayShort(date),
      dayNumber: parseDateKey(date).getDate(),
      sessions,
      session: sessions[0] ?? null,
    }
  })

  const overdue = activePlanned
    .filter(
      (session) =>
        session.scheduledDate < todayKey &&
        (session.status === 'pending' || session.status === 'in_progress'),
    )
    .sort((a, b) =>
      b.scheduledDate.localeCompare(a.scheduledDate) || comparePlannedWorkoutSessions(a, b),
    )

  const todayActionable = activePlanned
    .filter(
      (session) =>
        session.scheduledDate === todayKey &&
        (session.status === 'pending' || session.status === 'in_progress'),
    )
    .sort(comparePlannedWorkoutSessions)

  const futurePending = activePlanned
    .filter(
      (session) =>
        session.scheduledDate > todayKey &&
        session.status === 'pending',
    )
    .sort(comparePlannedWorkoutSessions)

  const actionableSessions = [
    ...overdue,
    ...todayActionable,
    ...futurePending,
  ]

  const focusSession = actionableSessions[0] ?? null
  const nextSession = actionableSessions[1] ?? null

  const focusTemplate = focusSession
    ? templates.find(
        (item) => item.template.id === focusSession.workoutTemplateId,
      ) ?? null
    : null

  const weekSessions = activePlanned.filter((session) =>
    weekDates.includes(session.scheduledDate),
  )

  return {
    todayKey,
    week,
    focusSession,
    nextSession,
    actionableSessions,
    focusTemplate,
    completedThisWeek: weekSessions.filter(
      (session) => session.status === 'completed',
    ).length,
    plannedThisWeek: weekSessions.length,
    unresolvedPast: overdue.length,
    streak: streakInfo.streak,
    streakPending: streakInfo.pending,
    mobilityTemplate:
      templates.find(
        (item) => item.template.id === 'workout-mobility-daily',
      ) ?? null,
    recoveryTemplate:
      templates.find(
        (item) => item.template.id === 'workout-recovery-weekly',
      ) ?? null,
  }
}

async function getPreviousCompletedSets(
  exerciseId: string,
  currentSessionId: string,
): Promise<ExerciseSet[]> {
  const sessions = (await db.workoutSessions.toArray())
    .filter(
      (session) =>
        session.deletedAt === null &&
        session.id !== currentSessionId &&
        (session.status === 'completed' || session.status === 'incomplete'),
    )
    .sort((a, b) => {
      const dateA = a.endedAt ?? a.completedAt ?? a.startedAt
      const dateB = b.endedAt ?? b.completedAt ?? b.startedAt
      return Date.parse(dateB) - Date.parse(dateA)
    })

  for (const session of sessions) {
    const sets = (await db.exerciseSets
      .where('[workoutSessionId+exerciseId]')
      .equals([session.id, exerciseId])
      .toArray())
      .filter(
        (set) =>
          set.deletedAt === null &&
          set.completedAt !== null &&
          set.setType === 'working',
      )
      .sort((a, b) => a.order - b.order)

    if (sets.length > 0) {
      return sets
    }
  }

  return []
}

function progressionHint(
  snapshot: WorkoutSessionExercise,
  previousSets: ExerciseSet[],
) {
  if (previousSets.length === 0) {
    return 'Sin comparación válida. Usa hoy como nueva referencia.'
  }

  const valid = previousSets.filter(
    (set) => set.reps !== null && set.reps > 0,
  )

  if (valid.length === 0) {
    return 'Sin comparación válida. Mantén una carga cómoda y registra el resultado.'
  }

  const rirFloor = snapshot.targetRirMin
  const reachedTop = valid.every(
    (set) =>
      (set.reps ?? 0) >= snapshot.maxReps &&
      (rirFloor === null || set.rir === null || set.rir >= rirFloor),
  )

  if (reachedTop) {
    return 'Rango superior conseguido. Si hoy mantienes el RIR objetivo, prueba la subida mínima disponible.'
  }

  const underRange = valid.some(
    (set) =>
      (set.reps ?? 0) < snapshot.minReps ||
      (rirFloor !== null && set.rir !== null && set.rir < rirFloor),
  )

  if (underRange) {
    return 'Mantén o ajusta ligeramente la carga hasta recuperar el rango con el RIR objetivo.'
  }

  return 'Mantén la carga e intenta sumar alguna repetición dentro del rango sin forzar el RIR.'
}

async function getRestEndsAt(sessionId: string) {
  const meta = await db.appMeta.get(restTimerKey(sessionId))

  if (!meta) {
    return null
  }

  if (Date.parse(meta.value) <= Date.now()) {
    await db.appMeta.delete(meta.key)
    return null
  }

  return meta.value
}

export async function getActiveWorkout(): Promise<ActiveSessionView | null> {
  const activeSessions = (await db.workoutSessions
    .where('status')
    .equals('active')
    .toArray())
    .filter((item) => item.deletedAt === null)
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt) || a.id.localeCompare(b.id))

  if (activeSessions.length > 1) {
    throw new TrainingIntegrityError(
      'Integridad Training: existen varias ejecuciones activas simultáneas.',
    )
  }

  const session = activeSessions[0]

  if (!session) {
    return null
  }

  const [template, planned] = await Promise.all([
    db.workoutTemplates.get(session.workoutTemplateId),
    session.plannedWorkoutId
      ? db.plannedWorkoutSessions.get(session.plannedWorkoutId)
      : Promise.resolve(undefined),
  ])

  if (!template) {
    throw new Error('No se encuentra la plantilla del entrenamiento activo.')
  }

  const snapshots = (await db.workoutSessionExercises
    .where('workoutSessionId')
    .equals(session.id)
    .toArray())
    .filter((item) => item.deletedAt === null)
    .sort((a, b) => a.order - b.order)

  const exercises: ActiveExerciseView[] = []

  for (const snapshot of snapshots) {
    const exercise = await db.exercises.get(snapshot.exerciseId)

    if (!exercise) {
      continue
    }

    const sets = (await db.exerciseSets
      .where('workoutSessionId')
      .equals(session.id)
      .toArray())
      .filter(
        (set) =>
          set.deletedAt === null &&
          set.workoutSessionExerciseId === snapshot.id,
      )
      .sort((a, b) => {
        if (a.setType !== b.setType) {
          return a.setType === 'warmup' ? -1 : 1
        }

        return a.order - b.order
      })

    const previousSets = await getPreviousCompletedSets(
      snapshot.exerciseId,
      session.id,
    )

    exercises.push({
      snapshot,
      exercise,
      sets,
      previousSets,
      progressionHint: progressionHint(snapshot, previousSets),
    })
  }

  const allSets = exercises.flatMap((item) => item.sets)

  return {
    session,
    planned: planned ?? null,
    template,
    exercises,
    restEndsAt: await getRestEndsAt(session.id),
    completedWorkingSets: allSets.filter(
      (set) => set.setType === 'working' && set.completedAt !== null,
    ).length,
    totalWorkingSets: allSets.filter((set) => set.setType === 'working').length,
  }
}

async function warmupSetsFor(
  item: TemplateExerciseView,
  previousSets: ExerciseSet[],
) {
  if (item.exercise.exerciseType !== 'compound') {
    return []
  }

  const previousWeight = previousSets.find(
    (set) => set.weight !== null && (set.weight ?? 0) > 0,
  )?.weight

  const baseWeight = previousWeight ?? item.config.referenceWeight

  const ratios = item.config.order === 1
    ? [
        { ratio: 0.5, reps: 8 },
        { ratio: 0.7, reps: 4 },
        { ratio: 0.8, reps: 2 },
      ]
    : [
        { ratio: 0.6, reps: 5 },
      ]

  return ratios.map((entry, index) => ({
    order: index + 1,
    weight:
      baseWeight !== null && baseWeight !== undefined
        ? roundLoad(baseWeight * entry.ratio)
        : null,
    reps: entry.reps,
  }))
}

class TrainingIntegrityError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TrainingIntegrityError'
  }
}

async function buildSessionFromTemplate(
  template: WorkoutTemplate,
  plannedWorkoutId: string | null,
) {
  const templateExercises = await getTemplateExercises(template.id)
  const startedAt = nowIso()

  const session: WorkoutSession = {
    ...createEntityBase(),
    workoutTemplateId: template.id,
    templateName: template.name,
    status: 'active',
    plannedWorkoutId,
    startedAt,
    completedAt: null,
    endedAt: null,
    notes: null,
  }

  const snapshots: WorkoutSessionExercise[] = []
  const sets: ExerciseSet[] = []

  for (const item of templateExercises) {
    const snapshot: WorkoutSessionExercise = {
      ...createEntityBase(),
      workoutSessionId: session.id,
      sourceTemplateExerciseId: item.config.id,
      exerciseId: item.exercise.id,
      exerciseName: item.exercise.name,
      order: item.config.order,
      targetSets: item.config.targetSets,
      minReps: item.config.minReps,
      maxReps: item.config.maxReps,
      targetRirMin: item.config.targetRirMin ?? item.config.targetRir ?? null,
      targetRirMax: item.config.targetRirMax ?? item.config.targetRir ?? null,
      restSeconds: item.config.restSeconds,
      substitutedFromExerciseId: null,
      notes: null,
      targetSeconds: item.config.targetSeconds ?? null,
    }

    snapshots.push(snapshot)

    const previousSets = await getPreviousCompletedSets(
      item.exercise.id,
      session.id,
    )

    const warmups = template.isFormalStrength
      ? await warmupSetsFor(item, previousSets)
      : []

    for (const warmup of warmups) {
      sets.push({
        ...createEntityBase(),
        workoutSessionId: session.id,
        workoutSessionExerciseId: snapshot.id,
        exerciseId: item.exercise.id,
        exerciseName: item.exercise.name,
        order: warmup.order,
        setType: 'warmup',
        weight: warmup.weight,
        reps: warmup.reps,
        rir: null,
        completedAt: null,
      })
    }

    for (let setNumber = 1; setNumber <= item.config.targetSets; setNumber += 1) {
      sets.push({
        ...createEntityBase(),
        workoutSessionId: session.id,
        workoutSessionExerciseId: snapshot.id,
        exerciseId: item.exercise.id,
        exerciseName: item.exercise.name,
        order: setNumber,
        setType: 'working',
        weight: previousSets[setNumber - 1]?.weight ?? null,
        reps: null,
        rir: null,
        completedAt: null,
      })
    }
  }

  return {
    session,
    snapshots,
    sets,
  }
}

async function createSessionFromTemplate(
  template: WorkoutTemplate,
  plannedWorkoutId: string | null,
) {
  const prepared = await buildSessionFromTemplate(template, plannedWorkoutId)

  const outcome = await db.transaction(
    'rw',
    db.workoutSessions,
    db.workoutSessionExercises,
    db.exerciseSets,
    db.plannedWorkoutSessions,
    async () => {
      const activeSessions = (await db.workoutSessions
        .where('status')
        .equals('active')
        .toArray())
        .filter((session) => session.deletedAt === null)
        .sort((a, b) => a.startedAt.localeCompare(b.startedAt) || a.id.localeCompare(b.id))

      if (activeSessions.length > 1) {
        throw new TrainingIntegrityError(
          'Integridad Training: existen varias ejecuciones activas simultáneas.',
        )
      }

      if (plannedWorkoutId) {
        const planned = await db.plannedWorkoutSessions.get(plannedWorkoutId)

        if (!planned || planned.deletedAt !== null) {
          throw new Error('La sesión planificada no existe.')
        }

        assertPlannedCanStart(planned.status)

        if (planned.workoutTemplateId !== template.id) {
          throw new TrainingIntegrityError(
            'Integridad Training: la planificación ya no corresponde a la plantilla solicitada.',
          )
        }

        if (planned.status === 'in_progress') {
          if (!planned.executionSessionId) {
            throw new TrainingIntegrityError(
              'Integridad Training: la planificación en curso no tiene ejecución asociada.',
            )
          }

          const execution = await db.workoutSessions.get(planned.executionSessionId)

          if (
            !execution ||
            execution.deletedAt !== null ||
            execution.status !== 'active' ||
            execution.plannedWorkoutId !== planned.id ||
            execution.workoutTemplateId !== planned.workoutTemplateId
          ) {
            throw new TrainingIntegrityError(
              'Integridad Training: la ejecución asociada a la planificación en curso no es válida.',
            )
          }

          if (activeSessions.length !== 1 || activeSessions[0].id !== execution.id) {
            throw new TrainingIntegrityError(
              'Integridad Training: la ejecución asociada no coincide con la única sesión activa.',
            )
          }

          return {
            sessionId: execution.id,
            created: false,
          }
        }

        if (activeSessions.length === 1) {
          if (activeSessions[0].plannedWorkoutId === planned.id) {
            throw new TrainingIntegrityError(
              'Integridad Training: existe una ejecución activa para una planificación que sigue pendiente.',
            )
          }

          return {
            sessionId: activeSessions[0].id,
            created: false,
          }
        }

        await db.workoutSessions.add(prepared.session)
        await db.workoutSessionExercises.bulkAdd(prepared.snapshots)
        await db.exerciseSets.bulkAdd(prepared.sets)

        const updated = await db.plannedWorkoutSessions.update(planned.id, {
          status: 'in_progress',
          executionSessionId: prepared.session.id,
          resolvedAt: null,
          updatedAt: nowIso(),
          version: planned.version + 1,
        })

        if (updated !== 1) {
          throw new TrainingIntegrityError(
            'Integridad Training: no se ha podido vincular la ejecución a la planificación.',
          )
        }

        return {
          sessionId: prepared.session.id,
          created: true,
        }
      }

      if (activeSessions.length === 1) {
        return {
          sessionId: activeSessions[0].id,
          created: false,
        }
      }

      await db.workoutSessions.add(prepared.session)
      await db.workoutSessionExercises.bulkAdd(prepared.snapshots)
      await db.exerciseSets.bulkAdd(prepared.sets)

      return {
        sessionId: prepared.session.id,
        created: true,
      }
    },
  )

  if (outcome.created) {
    publishCommittedMutation('training')
  }

  const active = await getActiveWorkout()

  if (!active || active.session.id !== outcome.sessionId) {
    throw new TrainingIntegrityError(
      'Integridad Training: no se ha podido recuperar la ejecución activa esperada.',
    )
  }

  return active
}

export async function startPlannedWorkout(plannedWorkoutId: string) {
  const planned = await db.plannedWorkoutSessions.get(plannedWorkoutId)

  if (!planned || planned.deletedAt !== null) {
    throw new Error('La sesión planificada no existe.')
  }

  assertPlannedCanStart(planned.status)

  const template = await db.workoutTemplates.get(planned.workoutTemplateId)

  if (!template || template.deletedAt !== null) {
    throw new Error('No se encuentra la rutina asociada.')
  }

  return createSessionFromTemplate(template, planned.id)
}

export async function startTemplateWorkout(workoutTemplateId: string) {
  const template = await db.workoutTemplates.get(workoutTemplateId)

  if (!template || template.deletedAt !== null) {
    throw new Error('No se encuentra la rutina seleccionada.')
  }

  return createSessionFromTemplate(template, null)
}

export async function saveSetDraft(setId: string, values: SetValues) {
  await db.transaction('rw', db.exerciseSets, async () => {
    const set = await db.exerciseSets.get(setId)

    if (!set || set.deletedAt !== null) {
      throw new Error('Serie no encontrada.')
    }

    const validationMode = set.completedAt === null ? 'draft' : 'complete'
    validateSetValues(values, set.setType, validationMode)

    const updated = await db.exerciseSets.update(setId, {
      ...values,
      updatedAt: nowIso(),
      version: set.version + 1,
    })

    if (updated !== 1) {
      throw new TrainingIntegrityError(
        'Integridad Training: no se ha podido guardar la serie.',
      )
    }
  })

  publishCommittedMutation('training')
}

export async function toggleSetCompletion(
  setId: string,
  values: SetValues,
): Promise<{
  completed: boolean
  restSeconds: number
}> {
  const outcome = await db.transaction(
    'rw',
    db.workoutSessions,
    db.workoutSessionExercises,
    db.exerciseSets,
    async () => {
      const set = await db.exerciseSets.get(setId)

      if (!set || set.deletedAt !== null) {
        throw new Error('Serie no encontrada.')
      }

      const session = await db.workoutSessions.get(set.workoutSessionId)

      if (!session || session.deletedAt !== null) {
        throw new TrainingIntegrityError(
          'Integridad Training: la sesión de la serie ya no está disponible.',
        )
      }

      if (session.status !== 'active') {
        throw new TrainingIntegrityError(
          'Integridad Training: solo se puede cambiar el estado de una serie durante una sesión activa.',
        )
      }

      const snapshot = set.workoutSessionExerciseId
        ? await db.workoutSessionExercises.get(set.workoutSessionExerciseId)
        : undefined

      if (set.workoutSessionExerciseId) {
        if (!snapshot || snapshot.deletedAt !== null) {
          throw new TrainingIntegrityError(
            'Integridad Training: el ejercicio de sesión de la serie ya no está disponible.',
          )
        }

        if (snapshot.workoutSessionId !== session.id) {
          throw new TrainingIntegrityError(
            'Integridad Training: la serie no pertenece al ejercicio de la ejecución indicada.',
          )
        }
      }

      if (set.completedAt !== null) {
        validateSetValues(values, set.setType, 'draft')

        const updated = await db.exerciseSets.update(setId, {
          ...values,
          completedAt: null,
          updatedAt: nowIso(),
          version: set.version + 1,
        })

        if (updated !== 1) {
          throw new TrainingIntegrityError(
            'Integridad Training: no se ha podido desmarcar la serie.',
          )
        }

        return {
          completed: false,
          restSeconds: 0,
        }
      }

      validateSetValues(values, set.setType, 'complete')

      const timestamp = nowIso()
      const updated = await db.exerciseSets.update(setId, {
        ...values,
        completedAt: timestamp,
        updatedAt: timestamp,
        version: set.version + 1,
      })

      if (updated !== 1) {
        throw new TrainingIntegrityError(
          'Integridad Training: no se ha podido completar la serie.',
        )
      }

      return {
        completed: true,
        restSeconds: set.setType === 'working' ? snapshot?.restSeconds ?? 0 : 0,
      }
    },
  )

  publishCommittedMutation('training')

  return outcome
}

export async function addExerciseSet(
  workoutSessionExerciseId: string,
  setType: SetType,
) {
  await db.transaction(
    'rw',
    db.workoutSessions,
    db.workoutSessionExercises,
    db.exerciseSets,
    async () => {
      const snapshot = await db.workoutSessionExercises.get(
        workoutSessionExerciseId,
      )

      if (!snapshot || snapshot.deletedAt !== null) {
        throw new Error('Ejercicio de sesión no encontrado.')
      }

      const session = await db.workoutSessions.get(snapshot.workoutSessionId)

      if (!session || session.deletedAt !== null) {
        throw new TrainingIntegrityError(
          'Integridad Training: la sesión del ejercicio ya no está disponible.',
        )
      }

      if (session.status !== 'active') {
        throw new TrainingIntegrityError(
          'Integridad Training: solo se pueden añadir series a una sesión activa.',
        )
      }

      if (snapshot.workoutSessionId !== session.id) {
        throw new TrainingIntegrityError(
          'Integridad Training: el ejercicio de sesión no pertenece a la ejecución indicada.',
        )
      }

      const currentSets = (await db.exerciseSets
        .where('workoutSessionId')
        .equals(session.id)
        .toArray())
        .filter(
          (set) =>
            set.deletedAt === null &&
            set.workoutSessionExerciseId === snapshot.id &&
            set.setType === setType,
        )

      const nextOrder =
        currentSets.reduce((highest, set) => Math.max(highest, set.order), 0) + 1

      await db.exerciseSets.add({
        ...createEntityBase(),
        workoutSessionId: session.id,
        workoutSessionExerciseId: snapshot.id,
        exerciseId: snapshot.exerciseId,
        exerciseName: snapshot.exerciseName,
        order: nextOrder,
        setType,
        weight: null,
        reps: null,
        rir: null,
        completedAt: null,
      })
    },
  )

  publishCommittedMutation('training')
}

export async function removeExerciseSet(setId: string) {
  const removed = await db.transaction(
    'rw',
    db.workoutSessions,
    db.workoutSessionExercises,
    db.exerciseSets,
    async () => {
      const set = await db.exerciseSets.get(setId)

      if (!set || set.deletedAt !== null) {
        return false
      }

      if (set.completedAt !== null) {
        throw new TrainingIntegrityError(
          'Desmarca la serie antes de eliminarla.',
        )
      }

      if (!set.workoutSessionExerciseId) {
        throw new TrainingIntegrityError(
          'Integridad Training: la serie no está vinculada a un ejercicio de sesión válido.',
        )
      }

      const snapshot = await db.workoutSessionExercises.get(
        set.workoutSessionExerciseId,
      )

      if (!snapshot || snapshot.deletedAt !== null) {
        throw new TrainingIntegrityError(
          'Integridad Training: el ejercicio de sesión ya no está disponible.',
        )
      }

      const session = await db.workoutSessions.get(set.workoutSessionId)

      if (!session || session.deletedAt !== null) {
        throw new TrainingIntegrityError(
          'Integridad Training: la sesión de la serie ya no está disponible.',
        )
      }

      if (session.status !== 'active') {
        throw new TrainingIntegrityError(
          'Integridad Training: solo se pueden eliminar series de una sesión activa.',
        )
      }

      if (
        snapshot.workoutSessionId !== session.id ||
        snapshot.id !== set.workoutSessionExerciseId
      ) {
        throw new TrainingIntegrityError(
          'Integridad Training: la serie no pertenece al ejercicio de la sesión indicada.',
        )
      }

      const now = nowIso()
      const updated = await db.exerciseSets.update(set.id, {
        deletedAt: now,
        updatedAt: now,
        version: set.version + 1,
      })

      if (updated !== 1) {
        throw new TrainingIntegrityError(
          'Integridad Training: no se ha podido eliminar la serie.',
        )
      }

      return true
    },
  )

  if (removed) {
    publishCommittedMutation('training')
  }
}

export async function startRestTimer(sessionId: string, seconds: number) {
  if (seconds <= 0) {
    return null
  }

  const end = new Date(Date.now() + seconds * 1000).toISOString()

  await db.appMeta.put({
    key: restTimerKey(sessionId),
    value: end,
    updatedAt: nowIso(),
  })

  return end
}

export async function stopRestTimer(sessionId: string) {
  await db.appMeta.delete(restTimerKey(sessionId))
}

export async function finishWorkout(
  workoutSessionId: string,
  result: 'completed' | 'incomplete',
) {
  if (result !== 'completed' && result !== 'incomplete') {
    throw new Error('Resultado de entrenamiento no válido.')
  }

  const endedAt = nowIso()

  await db.transaction(
    'rw',
    db.workoutSessions,
    db.plannedWorkoutSessions,
    db.exerciseSets,
    db.appMeta,
    async () => {
      const session = await db.workoutSessions.get(workoutSessionId)

      if (!session || session.deletedAt !== null) {
        throw new Error('Entrenamiento no encontrado.')
      }

      if (session.status !== 'active') {
        throw new Error('Solo se puede finalizar una sesión activa.')
      }

      const sets = (await db.exerciseSets
        .where('workoutSessionId')
        .equals(workoutSessionId)
        .toArray())
        .filter((set) => set.deletedAt === null)

      const completedWorkingSets = sets.filter(
        (set) => set.setType === 'working' && set.completedAt !== null,
      )

      if (completedWorkingSets.length === 0) {
        throw new Error(
          'No hay trabajo registrado. Descarta la sesión si se abrió por accidente.',
        )
      }

      let planned: PlannedWorkoutSession | undefined

      if (session.plannedWorkoutId) {
        planned = await db.plannedWorkoutSessions.get(session.plannedWorkoutId)

        if (
          !planned ||
          planned.deletedAt !== null ||
          planned.status !== 'in_progress' ||
          planned.executionSessionId !== session.id
        ) {
          throw new TrainingIntegrityError(
            'Integridad Training: la planificación vinculada no coincide con la ejecución activa.',
          )
        }
      }

      await db.workoutSessions.update(session.id, {
        status: result,
        completedAt: result === 'completed' ? endedAt : null,
        endedAt,
        updatedAt: endedAt,
        version: session.version + 1,
      })

      if (planned) {
        await db.plannedWorkoutSessions.update(planned.id, {
          status: result,
          executionSessionId: session.id,
          resolvedAt: endedAt,
          updatedAt: endedAt,
          version: planned.version + 1,
        })
      }

      await db.appMeta.delete(restTimerKey(session.id))
    },
  )

  publishCommittedMutation('training')
}

export async function discardEmptyWorkout(workoutSessionId: string) {
  const now = nowIso()

  await db.transaction(
    'rw',
    db.workoutSessions,
    db.workoutSessionExercises,
    db.exerciseSets,
    db.plannedWorkoutSessions,
    db.appMeta,
    async () => {
      const session = await db.workoutSessions.get(workoutSessionId)

      if (!session || session.deletedAt !== null) {
        throw new Error('Entrenamiento no encontrado.')
      }

      if (session.status !== 'active') {
        throw new Error('Solo se puede descartar una sesión activa.')
      }

      const sets = (await db.exerciseSets
        .where('workoutSessionId')
        .equals(workoutSessionId)
        .toArray())
        .filter((set) => set.deletedAt === null)

      if (sets.some((set) => set.setType === 'working' && set.completedAt !== null)) {
        throw new Error(
          'La sesión ya contiene trabajo real. Finalízala como completada o incompleta.',
        )
      }

      const snapshots = (await db.workoutSessionExercises
        .where('workoutSessionId')
        .equals(workoutSessionId)
        .toArray())
        .filter((item) => item.deletedAt === null)

      let planned: PlannedWorkoutSession | undefined

      if (session.plannedWorkoutId) {
        planned = await db.plannedWorkoutSessions.get(session.plannedWorkoutId)

        if (
          !planned ||
          planned.deletedAt !== null ||
          planned.status !== 'in_progress' ||
          planned.executionSessionId !== session.id
        ) {
          throw new TrainingIntegrityError(
            'Integridad Training: la planificación vinculada no coincide con la ejecución activa.',
          )
        }
      }

      await db.workoutSessions.update(session.id, {
        deletedAt: now,
        updatedAt: now,
        version: session.version + 1,
      })

      for (const snapshot of snapshots) {
        await db.workoutSessionExercises.update(snapshot.id, {
          deletedAt: now,
          updatedAt: now,
          version: snapshot.version + 1,
        })
      }

      for (const set of sets) {
        await db.exerciseSets.update(set.id, {
          deletedAt: now,
          updatedAt: now,
          version: set.version + 1,
        })
      }

      if (planned) {
        await db.plannedWorkoutSessions.update(planned.id, {
          status: 'pending',
          executionSessionId: null,
          resolvedAt: null,
          updatedAt: now,
          version: planned.version + 1,
        })
      }

      await db.appMeta.delete(restTimerKey(session.id))
    },
  )

  publishCommittedMutation('training')
}

export async function omitPlannedWorkout(plannedWorkoutId: string) {
  const now = nowIso()

  await db.transaction('rw', db.plannedWorkoutSessions, async () => {
    const planned = await db.plannedWorkoutSessions.get(plannedWorkoutId)

    if (!planned || planned.deletedAt !== null) {
      throw new Error('Sesión planificada no encontrada.')
    }

    assertPlannedPending(planned.status, 'omit')

    await db.plannedWorkoutSessions.update(planned.id, {
      status: 'omitted',
      resolvedAt: now,
      updatedAt: now,
      version: planned.version + 1,
    })
  })

  publishCommittedMutation('training')
}

export async function reprogramPlannedWorkout(
  plannedWorkoutId: string,
  newDate: string,
) {
  assertValidTrainingDateKey(newDate)

  const changed = await db.transaction('rw', db.plannedWorkoutSessions, async () => {
    const planned = await db.plannedWorkoutSessions.get(plannedWorkoutId)

    if (!planned || planned.deletedAt !== null) {
      throw new Error('Sesión planificada no encontrada.')
    }

    assertPlannedPending(planned.status, 'reprogram')

    if (planned.scheduledDate === newDate) {
      return false
    }

    await db.plannedWorkoutSessions.update(planned.id, {
      scheduledDate: newDate,
      rescheduleCount: planned.rescheduleCount + 1,
      updatedAt: nowIso(),
      version: planned.version + 1,
    })

    return true
  })

  if (changed) {
    publishCommittedMutation('training')
  }
}

export async function substituteSessionExercise(
  workoutSessionExerciseId: string,
  newExerciseId: string,
  updateRoutine: boolean,
) {
  await db.transaction(
    'rw',
    db.workoutSessions,
    db.workoutSessionExercises,
    db.exerciseSets,
    db.exercises,
    db.workoutTemplateExercises,
    async () => {
      const snapshot = await db.workoutSessionExercises.get(
        workoutSessionExerciseId,
      )

      if (!snapshot || snapshot.deletedAt !== null) {
        throw new Error('Ejercicio de sesión no encontrado.')
      }

      const session = await db.workoutSessions.get(snapshot.workoutSessionId)

      if (!session || session.deletedAt !== null) {
        throw new TrainingIntegrityError(
          'Integridad Training: la sesión del ejercicio ya no está disponible.',
        )
      }

      if (session.status !== 'active') {
        throw new TrainingIntegrityError(
          'Integridad Training: solo se puede sustituir un ejercicio durante una sesión activa.',
        )
      }

      if (snapshot.workoutSessionId !== session.id) {
        throw new TrainingIntegrityError(
          'Integridad Training: el ejercicio no pertenece a la ejecución indicada.',
        )
      }

      const sets = (await db.exerciseSets
        .where('workoutSessionId')
        .equals(session.id)
        .toArray())
        .filter(
          (set) =>
            set.deletedAt === null &&
            set.workoutSessionExerciseId === snapshot.id,
        )

      if (sets.some((set) => set.completedAt !== null)) {
        throw new TrainingIntegrityError(
          'No se puede sustituir después de registrar una serie. Añade el cambio antes de empezar ese ejercicio.',
        )
      }

      const nextExercise = await db.exercises.get(newExerciseId)

      if (!nextExercise || nextExercise.deletedAt !== null) {
        throw new Error('Ejercicio alternativo no encontrado.')
      }

      let templateConfig: WorkoutTemplateExercise | undefined

      if (updateRoutine) {
        if (!snapshot.sourceTemplateExerciseId) {
          throw new TrainingIntegrityError(
            'Integridad Training: este ejercicio no tiene una configuración de rutina actualizable.',
          )
        }

        templateConfig = await db.workoutTemplateExercises.get(
          snapshot.sourceTemplateExerciseId,
        )

        if (!templateConfig || templateConfig.deletedAt !== null) {
          throw new TrainingIntegrityError(
            'Integridad Training: la configuración de rutina ya no está disponible.',
          )
        }

        if (templateConfig.workoutTemplateId !== session.workoutTemplateId) {
          throw new TrainingIntegrityError(
            'Integridad Training: la configuración de rutina no pertenece a la plantilla de esta ejecución.',
          )
        }
      }

      const now = nowIso()

      const updatedSnapshot = await db.workoutSessionExercises.update(snapshot.id, {
        exerciseId: nextExercise.id,
        exerciseName: nextExercise.name,
        substitutedFromExerciseId:
          snapshot.substitutedFromExerciseId ?? snapshot.exerciseId,
        updatedAt: now,
        version: snapshot.version + 1,
      })

      if (updatedSnapshot !== 1) {
        throw new TrainingIntegrityError(
          'Integridad Training: no se ha podido actualizar el ejercicio de la sesión.',
        )
      }

      for (const set of sets) {
        const updatedSet = await db.exerciseSets.update(set.id, {
          exerciseId: nextExercise.id,
          exerciseName: nextExercise.name,
          updatedAt: now,
          version: set.version + 1,
        })

        if (updatedSet !== 1) {
          throw new TrainingIntegrityError(
            'Integridad Training: no se ha podido actualizar una serie durante la sustitución.',
          )
        }
      }

      if (updateRoutine && templateConfig) {
        const updatedTemplate = await db.workoutTemplateExercises.update(
          templateConfig.id,
          {
            exerciseId: nextExercise.id,
            updatedAt: now,
            version: templateConfig.version + 1,
          },
        )

        if (updatedTemplate !== 1) {
          throw new TrainingIntegrityError(
            'Integridad Training: no se ha podido actualizar la rutina futura.',
          )
        }
      }
    },
  )

  publishCommittedMutation('training')
}

export async function getExerciseAlternatives(snapshot: WorkoutSessionExercise) {
  const [config, currentExercise, exercises] = await Promise.all([
    snapshot.sourceTemplateExerciseId
      ? db.workoutTemplateExercises.get(snapshot.sourceTemplateExerciseId)
      : Promise.resolve(undefined),
    db.exercises.get(snapshot.exerciseId),
    db.exercises.toArray(),
  ])

  const preferredIds = config?.alternativeExerciseIds ?? []
  const currentMuscle = currentExercise?.primaryMuscle ?? null
  const all = exercises.filter(
    (exercise) =>
      exercise.deletedAt === null &&
      exercise.exerciseType !== 'mobility' &&
      exercise.exerciseType !== 'core' &&
      exercise.id !== snapshot.exerciseId,
  )

  return all.sort((a, b) => {
    const aPreferred = preferredIds.indexOf(a.id)
    const bPreferred = preferredIds.indexOf(b.id)

    if (aPreferred !== -1 || bPreferred !== -1) {
      if (aPreferred === -1) return 1
      if (bPreferred === -1) return -1
      return aPreferred - bPreferred
    }

    const aSameMuscle = currentMuscle !== null && a.primaryMuscle === currentMuscle
    const bSameMuscle = currentMuscle !== null && b.primaryMuscle === currentMuscle

    if (aSameMuscle !== bSameMuscle) {
      return aSameMuscle ? -1 : 1
    }

    return a.name.localeCompare(b.name)
  })
}

export async function getWorkoutHistory(limit = 20): Promise<TrainingHistoryView> {
  const sessions = (await db.workoutSessions.toArray())
    .filter(
      (session) =>
        session.deletedAt === null &&
        (session.status === 'completed' || session.status === 'incomplete'),
    )
    .sort((a, b) => {
      const dateA = a.endedAt ?? a.completedAt ?? a.startedAt
      const dateB = b.endedAt ?? b.completedAt ?? b.startedAt
      return Date.parse(dateB) - Date.parse(dateA)
    })
    .slice(0, limit)

  const result: HistorySessionView[] = []

  for (const session of sessions) {
    const [planned, sets, exercises] = await Promise.all([
      session.plannedWorkoutId
        ? db.plannedWorkoutSessions.get(session.plannedWorkoutId)
        : Promise.resolve(undefined),
      db.exerciseSets.where('workoutSessionId').equals(session.id).toArray(),
      db.workoutSessionExercises
        .where('workoutSessionId')
        .equals(session.id)
        .toArray(),
    ])

    result.push({
      session,
      planned: planned ?? null,
      sets: sets.filter(
        (set) => set.deletedAt === null && set.completedAt !== null,
      ),
      exercises: exercises
        .filter((item) => item.deletedAt === null)
        .sort((a, b) => a.order - b.order),
    })
  }

  return {
    sessions: result,
  }
}

export async function updateRoutineExercise(
  configId: string,
  values: {
    targetSets: number
    minReps: number
    maxReps: number
    targetRirMin: number | null
    targetRirMax: number | null
    restSeconds: number
  },
) {
  if (values.targetSets < 1 || values.minReps < 1 || values.maxReps < values.minReps) {
    throw new Error('Revisa series y rango de repeticiones.')
  }

  await db.transaction('rw', db.workoutTemplateExercises, async () => {
    const config = await db.workoutTemplateExercises.get(configId)
    if (!config || config.deletedAt !== null) throw new Error('Configuración no encontrada.')

    await db.workoutTemplateExercises.update(config.id, {
      ...values,
      targetRir: values.targetRirMin,
      updatedAt: nowIso(),
      version: config.version + 1,
    })
  })

  publishCommittedMutation('training')
}

export async function getExerciseCatalog() {
  return (await db.exercises.toArray())
    .filter((exercise) => exercise.deletedAt === null)
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

export async function updateExercisePersonalContext(
  exerciseId: string,
  values: {
    tolerance: ExerciseTolerance | null
    personalNotes: string | null
  },
) {
  await db.transaction('rw', db.exercises, async () => {
    const exercise = await db.exercises.get(exerciseId)
    if (!exercise || exercise.deletedAt !== null) throw new Error('Ejercicio no encontrado.')

    await db.exercises.update(exercise.id, {
      tolerance: values.tolerance,
      personalNotes: values.personalNotes,
      updatedAt: nowIso(),
      version: exercise.version + 1,
    })
  })

  publishCommittedMutation('training')
}

export interface WorkoutTemplateExerciseInput {
  id?: string
  exerciseId: string
  order: number
  targetSets: number
  minReps: number
  maxReps: number
  targetRirMin: number | null
  targetRirMax: number | null
  restSeconds: number
  referenceWeight?: number | null
  alternativeExerciseIds?: string[]
  supersetGroupId?: string | null
  targetSeconds?: number | null
}

export interface WorkoutTemplateDraft {
  name: string
  dayOfWeek: number | null
  type: WorkoutTemplate['type']
  description: string | null
  estimatedDurationMinutes: number | null
  isFormalStrength: boolean
  exercises: WorkoutTemplateExerciseInput[]
}

function validateTemplateDraft(input: WorkoutTemplateDraft) {
  if (!input.name.trim()) throw new Error('La rutina necesita un nombre.')
  if (input.dayOfWeek !== null && (!Number.isInteger(input.dayOfWeek) || input.dayOfWeek < 0 || input.dayOfWeek > 6)) {
    throw new Error('El día de la semana no es válido.')
  }
  const seenOrders = new Set<number>()
  for (const item of input.exercises) {
    if (!Number.isFinite(item.order) || item.order < 0 || seenOrders.has(item.order)) {
      throw new Error('El orden de ejercicios debe ser único y válido.')
    }
    seenOrders.add(item.order)
    if (item.targetSets < 1 || item.minReps < 1 || item.maxReps < item.minReps || item.restSeconds < 0) {
      throw new Error('Revisa series, repeticiones y descanso de la rutina.')
    }
  }
}

export async function createWorkoutTemplate(input: WorkoutTemplateDraft) {
  validateTemplateDraft(input)
  const templateId = createUuid()

  await db.transaction(
    'rw',
    db.workoutTemplates,
    db.workoutTemplateExercises,
    db.exercises,
    async () => {
      const exercises = new Map(
        (await db.exercises.bulkGet(input.exercises.map((item) => item.exerciseId)))
          .filter((item): item is Exercise => Boolean(item))
          .map((item) => [item.id, item]),
      )
      for (const item of input.exercises) {
        const exercise = exercises.get(item.exerciseId)
        if (!exercise || exercise.deletedAt !== null) throw new Error('La rutina contiene un ejercicio no disponible.')
      }

      const template: WorkoutTemplate = {
        ...createEntityBase(templateId),
        name: input.name.trim(),
        dayOfWeek: input.dayOfWeek,
        type: input.type,
        description: input.description?.trim() || null,
        estimatedDurationMinutes: input.estimatedDurationMinutes,
        isFormalStrength: input.isFormalStrength,
      }
      await db.workoutTemplates.add(template)

      const configs: WorkoutTemplateExercise[] = input.exercises.map((item) => ({
        ...createEntityBase(item.id ?? createUuid()),
        workoutTemplateId: templateId,
        exerciseId: item.exerciseId,
        order: item.order,
        targetSets: item.targetSets,
        minReps: item.minReps,
        maxReps: item.maxReps,
        targetRir: item.targetRirMin,
        targetRirMin: item.targetRirMin,
        targetRirMax: item.targetRirMax,
        restSeconds: item.restSeconds,
        referenceWeight: item.referenceWeight ?? null,
        alternativeExerciseIds: [...new Set(item.alternativeExerciseIds ?? [])],
        supersetGroupId: item.supersetGroupId?.trim() || null,
        targetSeconds: item.targetSeconds ?? null,
      }))
      if (configs.length > 0) await db.workoutTemplateExercises.bulkAdd(configs)
    },
  )

  publishCommittedMutation('training')
  return (await getTrainingTemplates()).find((item) => item.template.id === templateId) ?? null
}

export async function updateWorkoutTemplate(templateId: string, input: WorkoutTemplateDraft) {
  validateTemplateDraft(input)

  await db.transaction(
    'rw',
    db.workoutTemplates,
    db.workoutTemplateExercises,
    db.exercises,
    async () => {
      const template = await db.workoutTemplates.get(templateId)
      if (!template || template.deletedAt !== null) throw new Error('Rutina no encontrada.')

      const currentConfigs = (await db.workoutTemplateExercises.where('workoutTemplateId').equals(template.id).toArray())
        .filter((item) => item.deletedAt === null)
      const currentById = new Map(currentConfigs.map((item) => [item.id, item]))
      const incomingIds = new Set(input.exercises.flatMap((item) => item.id ? [item.id] : []))
      const exercises = new Map(
        (await db.exercises.bulkGet(input.exercises.map((item) => item.exerciseId)))
          .filter((item): item is Exercise => Boolean(item))
          .map((item) => [item.id, item]),
      )
      for (const item of input.exercises) {
        const exercise = exercises.get(item.exerciseId)
        if (!exercise || exercise.deletedAt !== null) throw new Error('La rutina contiene un ejercicio no disponible.')
        if (item.id && !currentById.has(item.id)) throw new Error('La rutina ha cambiado. Recarga antes de guardar.')
      }

      const now = nowIso()
      const nextConfigs: WorkoutTemplateExercise[] = input.exercises.map((item) => {
        const current = item.id ? currentById.get(item.id) : undefined
        if (current) {
          return {
            ...current,
            exerciseId: item.exerciseId,
            order: item.order,
            targetSets: item.targetSets,
            minReps: item.minReps,
            maxReps: item.maxReps,
            targetRir: item.targetRirMin,
            targetRirMin: item.targetRirMin,
            targetRirMax: item.targetRirMax,
            restSeconds: item.restSeconds,
            referenceWeight: item.referenceWeight ?? null,
            alternativeExerciseIds: [...new Set(item.alternativeExerciseIds ?? [])],
            supersetGroupId: item.supersetGroupId?.trim() || null,
            targetSeconds: item.targetSeconds ?? null,
            updatedAt: now,
            version: current.version + 1,
          }
        }
        return {
        ...createEntityBase(item.id ?? createUuid()),
          workoutTemplateId: template.id,
          exerciseId: item.exerciseId,
          order: item.order,
          targetSets: item.targetSets,
          minReps: item.minReps,
          maxReps: item.maxReps,
          targetRir: item.targetRirMin,
          targetRirMin: item.targetRirMin,
          targetRirMax: item.targetRirMax,
          restSeconds: item.restSeconds,
          referenceWeight: item.referenceWeight ?? null,
          alternativeExerciseIds: [...new Set(item.alternativeExerciseIds ?? [])],
          supersetGroupId: item.supersetGroupId?.trim() || null,
          targetSeconds: item.targetSeconds ?? null,
        }
      })
      const archived = currentConfigs
        .filter((item) => !incomingIds.has(item.id))
        .map((item) => ({ ...item, deletedAt: now, updatedAt: now, version: item.version + 1 }))

      await db.workoutTemplates.update(template.id, {
        name: input.name.trim(),
        dayOfWeek: input.dayOfWeek,
        type: input.type,
        description: input.description?.trim() || null,
        estimatedDurationMinutes: input.estimatedDurationMinutes,
        isFormalStrength: input.isFormalStrength,
        updatedAt: now,
        version: template.version + 1,
      })
      if (nextConfigs.length > 0) await db.workoutTemplateExercises.bulkPut(nextConfigs)
      if (archived.length > 0) await db.workoutTemplateExercises.bulkPut(archived)
    },
  )

  publishCommittedMutation('training')
}

export async function duplicateWorkoutTemplate(templateId: string) {
  const duplicateId = createUuid()

  await db.transaction(
    'rw',
    db.workoutTemplates,
    db.workoutTemplateExercises,
    db.exercises,
    async () => {
      const source = await db.workoutTemplates.get(templateId)
      if (!source || source.deletedAt !== null) throw new Error('Rutina no encontrada.')

      const sourceConfigs = (await db.workoutTemplateExercises.where('workoutTemplateId').equals(source.id).toArray())
        .filter((item) => item.deletedAt === null)
        .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
      const exercises = new Map(
        (await db.exercises.bulkGet(sourceConfigs.map((item) => item.exerciseId)))
          .filter((item): item is Exercise => Boolean(item))
          .map((item) => [item.id, item]),
      )
      for (const config of sourceConfigs) {
        const exercise = exercises.get(config.exerciseId)
        if (!exercise || exercise.deletedAt !== null) {
          throw new Error('La rutina contiene un ejercicio no disponible.')
        }
      }

      const duplicate: WorkoutTemplate = {
        ...createEntityBase(duplicateId),
        name: `${source.name} · copia`,
        dayOfWeek: null,
        type: source.type,
        description: source.description,
        estimatedDurationMinutes: source.estimatedDurationMinutes ?? null,
        isFormalStrength: source.isFormalStrength ?? false,
      }
      await db.workoutTemplates.add(duplicate)

      if (sourceConfigs.length > 0) {
        await db.workoutTemplateExercises.bulkAdd(
          sourceConfigs.map((config) => ({
            ...createEntityBase(createUuid()),
            workoutTemplateId: duplicateId,
            exerciseId: config.exerciseId,
            order: config.order,
            targetSets: config.targetSets,
            minReps: config.minReps,
            maxReps: config.maxReps,
            targetRir: config.targetRirMin ?? config.targetRir ?? null,
            targetRirMin: config.targetRirMin ?? config.targetRir ?? null,
            targetRirMax: config.targetRirMax ?? config.targetRir ?? null,
            restSeconds: config.restSeconds,
            referenceWeight: config.referenceWeight,
            alternativeExerciseIds: [...new Set(config.alternativeExerciseIds ?? [])],
            supersetGroupId: config.supersetGroupId ?? null,
            targetSeconds: config.targetSeconds ?? null,
          })),
        )
      }
    },
  )

  publishCommittedMutation('training')
  return (await getTrainingTemplates()).find((item) => item.template.id === duplicateId) ?? null
}

export async function archiveWorkoutTemplate(templateId: string) {
  await db.transaction(
    'rw',
    db.workoutTemplates,
    db.workoutTemplateExercises,
    db.plannedWorkoutSessions,
    async () => {
      const template = await db.workoutTemplates.get(templateId)
      if (!template || template.deletedAt !== null) return
      const operational = (await db.plannedWorkoutSessions.where('workoutTemplateId').equals(template.id).toArray())
        .some((item) => item.deletedAt === null && (item.status === 'pending' || item.status === 'in_progress'))
      if (operational) throw new Error('No puedes archivar una rutina con sesiones pendientes o en curso.')
      const now = nowIso()
      const configs = (await db.workoutTemplateExercises.where('workoutTemplateId').equals(template.id).toArray())
        .filter((item) => item.deletedAt === null)
        .map((item) => ({ ...item, deletedAt: now, updatedAt: now, version: item.version + 1 }))
      await db.workoutTemplates.update(template.id, { deletedAt: now, updatedAt: now, version: template.version + 1 })
      if (configs.length > 0) await db.workoutTemplateExercises.bulkPut(configs)
    },
  )
  publishCommittedMutation('training')
}

export interface CustomExerciseDraft {
  name: string
  primaryMuscle: string
  secondaryMuscles: string[]
  equipment: string
  exerciseType: Exercise['exerciseType']
  tolerance: ExerciseTolerance | null
  personalNotes: string | null
  techniqueNotes: string | null
  mediaPath: string | null
  mediaType: Exercise['mediaType']
}

function normalizeExerciseName(value: string) {
  return value.trim().toLocaleLowerCase('es')
}

function validateCustomExerciseDraft(input: CustomExerciseDraft) {
  if (!input.name.trim()) throw new Error('El ejercicio necesita un nombre.')
  if (!input.primaryMuscle.trim()) throw new Error('Indica el músculo principal.')
  if (!input.equipment.trim()) throw new Error('Indica el equipamiento.')
}

export function isSystemExercise(exercise: Exercise) {
  return exercise.id.startsWith('ex-')
}

export async function createCustomExercise(input: CustomExerciseDraft) {
  validateCustomExerciseDraft(input)
  const id = createUuid()
  await db.transaction('rw', db.exercises, async () => {
    const normalized = normalizeExerciseName(input.name)
    const duplicate = (await db.exercises.toArray()).some(
      (item) => item.deletedAt === null && normalizeExerciseName(item.name) === normalized,
    )
    if (duplicate) throw new Error('Ya existe un ejercicio activo con ese nombre.')
    const exercise: Exercise = {
      ...createEntityBase(id),
      name: input.name.trim(),
      primaryMuscle: input.primaryMuscle.trim(),
      secondaryMuscles: input.secondaryMuscles.map((item) => item.trim()).filter(Boolean),
      equipment: input.equipment.trim(),
      exerciseType: input.exerciseType,
      spineLoad: 'low',
      tolerance: input.tolerance,
      personalNotes: input.personalNotes?.trim() || null,
      techniqueNotes: input.techniqueNotes?.trim() || null,
      mediaPath: input.mediaPath?.trim() || null,
      mediaType: input.mediaType,
    }
    await db.exercises.add(exercise)
  })
  publishCommittedMutation('training')
  return db.exercises.get(id)
}

export async function updateCustomExercise(exerciseId: string, input: CustomExerciseDraft) {
  validateCustomExerciseDraft(input)
  await db.transaction('rw', db.exercises, async () => {
    const current = await db.exercises.get(exerciseId)
    if (!current || current.deletedAt !== null) throw new Error('Ejercicio no encontrado.')
    if (isSystemExercise(current)) throw new Error('Los ejercicios del sistema no se editan; usa contexto personal o crea uno propio.')
    const normalized = normalizeExerciseName(input.name)
    const duplicate = (await db.exercises.toArray()).some(
      (item) => item.id !== current.id && item.deletedAt === null && normalizeExerciseName(item.name) === normalized,
    )
    if (duplicate) throw new Error('Ya existe un ejercicio activo con ese nombre.')
    await db.exercises.update(current.id, {
      name: input.name.trim(),
      primaryMuscle: input.primaryMuscle.trim(),
      secondaryMuscles: input.secondaryMuscles.map((item) => item.trim()).filter(Boolean),
      equipment: input.equipment.trim(),
      exerciseType: input.exerciseType,
      tolerance: input.tolerance,
      personalNotes: input.personalNotes?.trim() || null,
      techniqueNotes: input.techniqueNotes?.trim() || null,
      mediaPath: input.mediaPath?.trim() || null,
      mediaType: input.mediaType,
      updatedAt: nowIso(),
      version: current.version + 1,
    })
  })
  publishCommittedMutation('training')
}

export async function archiveCustomExercise(exerciseId: string) {
  await db.transaction(
    'rw',
    db.exercises,
    db.workoutTemplateExercises,
    async () => {
      const current = await db.exercises.get(exerciseId)
      if (!current || current.deletedAt !== null) return
      if (isSystemExercise(current)) throw new Error('Los ejercicios del sistema no pueden archivarse.')
      const inActiveTemplate = (await db.workoutTemplateExercises.where('exerciseId').equals(current.id).toArray())
        .some((item) => item.deletedAt === null)
      if (inActiveTemplate) throw new Error('Retira primero este ejercicio de las rutinas activas.')
      const now = nowIso()
      await db.exercises.update(current.id, { deletedAt: now, updatedAt: now, version: current.version + 1 })
    },
  )
  publishCommittedMutation('training')
}
