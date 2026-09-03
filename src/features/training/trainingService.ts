import { db } from '../../db/database'
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
  session: PlannedWorkoutSession | null
}

export interface TrainingHomeView {
  todayKey: string
  week: TrainingWeekDayView[]
  focusSession: PlannedWorkoutSession | null
  nextSession: PlannedWorkoutSession | null
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

export interface SetValues {
  weight: number | null
  reps: number | null
  rir: number | null
}

function nowIso() {
  return new Date().toISOString()
}

function createEntityBase(id = crypto.randomUUID()) {
  const now = nowIso()

  return {
    id,
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

function parseDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(year, month - 1, day, 12, 0, 0, 0)
}

function shiftDateKey(dateKey: string, amount: number) {
  const date = parseDateKey(dateKey)
  date.setDate(date.getDate() + amount)
  return getLocalDateKey(date)
}

function startOfWeek(dateKey: string) {
  const date = parseDateKey(dateKey)
  const weekday = date.getDay()
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday
  date.setDate(date.getDate() + mondayOffset)
  return getLocalDateKey(date)
}

function formatWeekday(dateKey: string) {
  return new Intl.DateTimeFormat('es-ES', {
    weekday: 'short',
  })
    .format(parseDateKey(dateKey))
    .replace('.', '')
    .slice(0, 2)
    .toUpperCase()
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

async function getTrainingStreak() {
  const sessions = (await db.plannedWorkoutSessions.toArray())
    .filter(
      (session) =>
        session.deletedAt === null &&
        session.isFormalStrength &&
        !session.isExtra &&
        session.scheduledDate <= getLocalDateKey(),
    )
    .sort((a, b) => {
      if (a.scheduledDate === b.scheduledDate) {
        return a.createdAt.localeCompare(b.createdAt)
      }

      return a.scheduledDate.localeCompare(b.scheduledDate)
    })

  let streak = 0
  let pending = false

  for (let index = sessions.length - 1; index >= 0; index -= 1) {
    const session = sessions[index]

    if (session.status === 'pending' || session.status === 'in_progress') {
      pending = true
      continue
    }

    if (session.status === 'completed') {
      streak += 1
      continue
    }

    break
  }

  return {
    streak,
    pending,
  }
}

export async function getTrainingHome(
  todayKey = getLocalDateKey(),
): Promise<TrainingHomeView> {
  const [templates, planned, streakInfo] = await Promise.all([
    getTrainingTemplates(),
    db.plannedWorkoutSessions.toArray(),
    getTrainingStreak(),
  ])

  const activePlanned = planned
    .filter(
      (session) =>
        session.deletedAt === null &&
        session.isFormalStrength &&
        !session.isExtra,
    )
    .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate))

  const monday = startOfWeek(todayKey)
  const weekDates = Array.from({ length: 7 }, (_, index) =>
    shiftDateKey(monday, index),
  )

  const week: TrainingWeekDayView[] = weekDates.map((date) => {
    const session =
      activePlanned.find((item) => item.scheduledDate === date) ?? null

    return {
      date,
      weekdayLabel: formatWeekday(date),
      dayNumber: parseDateKey(date).getDate(),
      session,
    }
  })

  const overdue = activePlanned
    .filter(
      (session) =>
        session.scheduledDate < todayKey &&
        (session.status === 'pending' || session.status === 'in_progress'),
    )
    .sort((a, b) => b.scheduledDate.localeCompare(a.scheduledDate))

  const todaySession = activePlanned.find(
    (session) =>
      session.scheduledDate === todayKey &&
      (session.status === 'pending' || session.status === 'in_progress'),
  )

  const futurePending = activePlanned.find(
    (session) =>
      session.scheduledDate > todayKey &&
      session.status === 'pending',
  )

  const focusSession = overdue[0] ?? todaySession ?? futurePending ?? null
  const nextSession = activePlanned.find(
    (session) =>
      session.status === 'pending' &&
      (!focusSession || session.id !== focusSession.id) &&
      session.scheduledDate >= todayKey,
  ) ?? null

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
  const session = (await db.workoutSessions
    .where('status')
    .equals('active')
    .toArray())
    .find((item) => item.deletedAt === null)

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

async function createSessionFromTemplate(
  template: WorkoutTemplate,
  planned: PlannedWorkoutSession | null,
) {
  const existing = await getActiveWorkout()

  if (existing) {
    return existing
  }

  const templateExercises = await getTemplateExercises(template.id)
  const startedAt = nowIso()

  const session: WorkoutSession = {
    ...createEntityBase(),
    workoutTemplateId: template.id,
    templateName: template.name,
    status: 'active',
    plannedWorkoutId: planned?.id ?? null,
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

  await db.transaction(
    'rw',
    db.workoutSessions,
    db.workoutSessionExercises,
    db.exerciseSets,
    db.plannedWorkoutSessions,
    async () => {
      await db.workoutSessions.add(session)
      await db.workoutSessionExercises.bulkAdd(snapshots)
      await db.exerciseSets.bulkAdd(sets)

      if (planned) {
        await db.plannedWorkoutSessions.update(planned.id, {
          status: 'in_progress',
          executionSessionId: session.id,
          updatedAt: nowIso(),
          version: planned.version + 1,
        })
      }
    },
  )

  const active = await getActiveWorkout()

  if (!active) {
    throw new Error('No se ha podido iniciar la sesión.')
  }

  return active
}

export async function startPlannedWorkout(plannedWorkoutId: string) {
  const planned = await db.plannedWorkoutSessions.get(plannedWorkoutId)

  if (!planned || planned.deletedAt !== null) {
    throw new Error('La sesión planificada no existe.')
  }

  if (planned.status !== 'pending' && planned.status !== 'in_progress') {
    throw new Error('Esta sesión ya está resuelta.')
  }

  const template = await db.workoutTemplates.get(planned.workoutTemplateId)

  if (!template || template.deletedAt !== null) {
    throw new Error('No se encuentra la rutina asociada.')
  }

  return createSessionFromTemplate(template, planned)
}

export async function startTemplateWorkout(workoutTemplateId: string) {
  const template = await db.workoutTemplates.get(workoutTemplateId)

  if (!template || template.deletedAt !== null) {
    throw new Error('No se encuentra la rutina seleccionada.')
  }

  return createSessionFromTemplate(template, null)
}

export async function saveSetDraft(setId: string, values: SetValues) {
  const set = await db.exerciseSets.get(setId)

  if (!set || set.deletedAt !== null) {
    throw new Error('Serie no encontrada.')
  }

  await db.exerciseSets.update(setId, {
    ...values,
    updatedAt: nowIso(),
    version: set.version + 1,
  })
}

export async function toggleSetCompletion(
  setId: string,
  values: SetValues,
): Promise<{
  completed: boolean
  restSeconds: number
}> {
  const set = await db.exerciseSets.get(setId)

  if (!set || set.deletedAt !== null) {
    throw new Error('Serie no encontrada.')
  }

  if (set.completedAt !== null) {
    await db.exerciseSets.update(setId, {
      ...values,
      completedAt: null,
      updatedAt: nowIso(),
      version: set.version + 1,
    })

    return {
      completed: false,
      restSeconds: 0,
    }
  }

  if (values.reps === null || values.reps <= 0) {
    throw new Error('Introduce las repeticiones antes de completar la serie.')
  }

  const snapshot = set.workoutSessionExerciseId
    ? await db.workoutSessionExercises.get(set.workoutSessionExerciseId)
    : undefined

  const timestamp = nowIso()

  await db.exerciseSets.update(setId, {
    ...values,
    completedAt: timestamp,
    updatedAt: timestamp,
    version: set.version + 1,
  })

  return {
    completed: true,
    restSeconds: set.setType === 'working' ? snapshot?.restSeconds ?? 0 : 0,
  }
}

export async function addExerciseSet(
  workoutSessionExerciseId: string,
  setType: SetType,
) {
  const snapshot = await db.workoutSessionExercises.get(workoutSessionExerciseId)

  if (!snapshot || snapshot.deletedAt !== null) {
    throw new Error('Ejercicio de sesión no encontrado.')
  }

  const currentSets = (await db.exerciseSets
    .where('workoutSessionId')
    .equals(snapshot.workoutSessionId)
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
    workoutSessionId: snapshot.workoutSessionId,
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
}

export async function removeExerciseSet(setId: string) {
  const set = await db.exerciseSets.get(setId)

  if (!set || set.deletedAt !== null) {
    return
  }

  const now = nowIso()

  await db.exerciseSets.update(set.id, {
    deletedAt: now,
    updatedAt: now,
    version: set.version + 1,
  })
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
  const session = await db.workoutSessions.get(workoutSessionId)

  if (!session || session.deletedAt !== null) {
    throw new Error('Entrenamiento no encontrado.')
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

  const endedAt = nowIso()
  const planned = session.plannedWorkoutId
    ? await db.plannedWorkoutSessions.get(session.plannedWorkoutId)
    : undefined

  await db.transaction(
    'rw',
    db.workoutSessions,
    db.plannedWorkoutSessions,
    db.appMeta,
    async () => {
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
}

export async function discardEmptyWorkout(workoutSessionId: string) {
  const session = await db.workoutSessions.get(workoutSessionId)

  if (!session || session.deletedAt !== null) {
    throw new Error('Entrenamiento no encontrado.')
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

  const planned = session.plannedWorkoutId
    ? await db.plannedWorkoutSessions.get(session.plannedWorkoutId)
    : undefined

  const now = nowIso()

  await db.transaction(
    'rw',
    db.workoutSessions,
    db.workoutSessionExercises,
    db.exerciseSets,
    db.plannedWorkoutSessions,
    db.appMeta,
    async () => {
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
}

export async function omitPlannedWorkout(plannedWorkoutId: string) {
  const planned = await db.plannedWorkoutSessions.get(plannedWorkoutId)

  if (!planned || planned.deletedAt !== null) {
    throw new Error('Sesión planificada no encontrada.')
  }

  if (planned.status !== 'pending') {
    throw new Error('Solo se puede omitir una sesión pendiente.')
  }

  const now = nowIso()

  await db.plannedWorkoutSessions.update(planned.id, {
    status: 'omitted',
    resolvedAt: now,
    updatedAt: now,
    version: planned.version + 1,
  })
}

export async function reprogramPlannedWorkout(
  plannedWorkoutId: string,
  newDate: string,
) {
  const planned = await db.plannedWorkoutSessions.get(plannedWorkoutId)

  if (!planned || planned.deletedAt !== null) {
    throw new Error('Sesión planificada no encontrada.')
  }

  if (planned.status !== 'pending') {
    throw new Error('Solo se puede reprogramar una sesión pendiente.')
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
    throw new Error('Fecha no válida.')
  }

  await db.plannedWorkoutSessions.update(planned.id, {
    scheduledDate: newDate,
    rescheduleCount: planned.rescheduleCount + 1,
    updatedAt: nowIso(),
    version: planned.version + 1,
  })
}

export async function substituteSessionExercise(
  workoutSessionExerciseId: string,
  newExerciseId: string,
  updateRoutine: boolean,
) {
  const [snapshot, nextExercise] = await Promise.all([
    db.workoutSessionExercises.get(workoutSessionExerciseId),
    db.exercises.get(newExerciseId),
  ])

  if (!snapshot || snapshot.deletedAt !== null) {
    throw new Error('Ejercicio de sesión no encontrado.')
  }

  if (!nextExercise || nextExercise.deletedAt !== null) {
    throw new Error('Ejercicio alternativo no encontrado.')
  }

  const sets = (await db.exerciseSets
    .where('workoutSessionId')
    .equals(snapshot.workoutSessionId)
    .toArray())
    .filter(
      (set) =>
        set.deletedAt === null &&
        set.workoutSessionExerciseId === snapshot.id,
    )

  if (sets.some((set) => set.completedAt !== null)) {
    throw new Error(
      'No se puede sustituir después de registrar una serie. Añade el cambio antes de empezar ese ejercicio.',
    )
  }

  const templateConfig = snapshot.sourceTemplateExerciseId
    ? await db.workoutTemplateExercises.get(snapshot.sourceTemplateExerciseId)
    : undefined

  const now = nowIso()

  await db.transaction(
    'rw',
    db.workoutSessionExercises,
    db.exerciseSets,
    db.workoutTemplateExercises,
    async () => {
      await db.workoutSessionExercises.update(snapshot.id, {
        exerciseId: nextExercise.id,
        exerciseName: nextExercise.name,
        substitutedFromExerciseId:
          snapshot.substitutedFromExerciseId ?? snapshot.exerciseId,
        updatedAt: now,
        version: snapshot.version + 1,
      })

      for (const set of sets) {
        await db.exerciseSets.update(set.id, {
          exerciseId: nextExercise.id,
          exerciseName: nextExercise.name,
          updatedAt: now,
          version: set.version + 1,
        })
      }

      if (updateRoutine && templateConfig) {
        await db.workoutTemplateExercises.update(templateConfig.id, {
          exerciseId: nextExercise.id,
          updatedAt: now,
          version: templateConfig.version + 1,
        })
      }
    },
  )
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
  const config = await db.workoutTemplateExercises.get(configId)

  if (!config || config.deletedAt !== null) {
    throw new Error('Configuración no encontrada.')
  }

  if (values.targetSets < 1 || values.minReps < 1 || values.maxReps < values.minReps) {
    throw new Error('Revisa series y rango de repeticiones.')
  }

  await db.workoutTemplateExercises.update(config.id, {
    ...values,
    targetRir: values.targetRirMin,
    updatedAt: nowIso(),
    version: config.version + 1,
  })
}

export async function getExerciseCatalog() {
  return (await db.exercises.toArray())
    .filter((exercise) => exercise.deletedAt === null)
    .sort((a, b) => a.name.localeCompare(b.name))
}

export async function updateExercisePersonalContext(
  exerciseId: string,
  values: {
    tolerance: ExerciseTolerance | null
    personalNotes: string | null
  },
) {
  const exercise = await db.exercises.get(exerciseId)

  if (!exercise || exercise.deletedAt !== null) {
    throw new Error('Ejercicio no encontrado.')
  }

  await db.exercises.update(exercise.id, {
    tolerance: values.tolerance,
    personalNotes: values.personalNotes,
    updatedAt: nowIso(),
    version: exercise.version + 1,
  })
}
