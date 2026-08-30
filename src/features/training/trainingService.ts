import { db } from '../../db/database'
import type {
  Exercise,
  ExerciseSet,
  SetType,
  WorkoutSession,
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

export interface ActiveExerciseView extends TemplateExerciseView {
  sets: ExerciseSet[]
  previousSets: ExerciseSet[]
}

export interface ActiveSessionView {
  session: WorkoutSession
  template: WorkoutTemplate
  exercises: ActiveExerciseView[]
}

export interface HistorySessionView {
  session: WorkoutSession
  sets: ExerciseSet[]
}

function createEntityBase() {
  const now = new Date().toISOString()

  return {
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    version: 1,
  }
}

async function getTemplateExercises(
  workoutTemplateId: string,
): Promise<TemplateExerciseView[]> {
  const configs = await db.workoutTemplateExercises
    .where('workoutTemplateId')
    .equals(workoutTemplateId)
    .toArray()

  configs.sort((a, b) => a.order - b.order)

  const result: TemplateExerciseView[] = []

  for (const config of configs) {
    if (config.deletedAt !== null) {
      continue
    }

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

export async function getTrainingTemplates(): Promise<
  TrainingTemplateView[]
> {
  const templates = await db.workoutTemplates.toArray()

  const activeTemplates = templates
    .filter((template) => template.deletedAt === null)
    .sort((a, b) => {
      const dayA = a.dayOfWeek ?? 99
      const dayB = b.dayOfWeek ?? 99
      return dayA - dayB
    })

  const result: TrainingTemplateView[] = []

  for (const template of activeTemplates) {
    const exercises = await getTemplateExercises(template.id)

    result.push({
      template,
      exercises,
      totalSets: exercises.reduce(
        (total, item) => total + item.config.targetSets,
        0,
      ),
    })
  }

  return result
}

async function getPreviousCompletedSets(
  exerciseId: string,
  currentSessionId: string,
): Promise<ExerciseSet[]> {
  const sessions = await db.workoutSessions
    .where('status')
    .equals('completed')
    .toArray()

  sessions.sort((a, b) => {
    const dateA = a.completedAt ?? a.startedAt
    const dateB = b.completedAt ?? b.startedAt

    return Date.parse(dateB) - Date.parse(dateA)
  })

  for (const session of sessions) {
    if (session.id === currentSessionId) {
      continue
    }

    const sets = await db.exerciseSets
      .where('[workoutSessionId+exerciseId]')
      .equals([session.id, exerciseId])
      .toArray()

    const completedSets = sets
      .filter(
        (set) =>
          set.completedAt !== null &&
          set.setType === 'working',
      )
      .sort((a, b) => a.order - b.order)

    if (completedSets.length > 0) {
      return completedSets
    }
  }

  return []
}

export async function getActiveWorkout(): Promise<
  ActiveSessionView | null
> {
  const session = await db.workoutSessions
    .where('status')
    .equals('active')
    .first()

  if (!session) {
    return null
  }

  const template = await db.workoutTemplates.get(
    session.workoutTemplateId,
  )

  if (!template) {
    throw new Error('No se encuentra la plantilla del entrenamiento.')
  }

  const templateExercises = await getTemplateExercises(template.id)
  const exercises: ActiveExerciseView[] = []

  for (const item of templateExercises) {
    const sets = await db.exerciseSets
      .where('[workoutSessionId+exerciseId]')
      .equals([session.id, item.exercise.id])
      .toArray()

    sets.sort((a, b) => a.order - b.order)

    exercises.push({
      ...item,
      sets,
      previousSets: await getPreviousCompletedSets(
        item.exercise.id,
        session.id,
      ),
    })
  }

  return {
    session,
    template,
    exercises,
  }
}

export async function startWorkout(
  workoutTemplateId: string,
): Promise<ActiveSessionView> {
  const existingSession = await getActiveWorkout()

  if (existingSession) {
    return existingSession
  }

  const template = await db.workoutTemplates.get(
    workoutTemplateId,
  )

  if (!template) {
    throw new Error('No se encuentra el entrenamiento seleccionado.')
  }

  const exercises = await getTemplateExercises(
    workoutTemplateId,
  )

  const now = new Date().toISOString()

  const session: WorkoutSession = {
    ...createEntityBase(),
    workoutTemplateId,
    templateName: template.name,
    status: 'active',
    startedAt: now,
    completedAt: null,
    notes: null,
  }

  const sets: ExerciseSet[] = []

  for (const item of exercises) {
    for (
      let setNumber = 1;
      setNumber <= item.config.targetSets;
      setNumber += 1
    ) {
      sets.push({
        ...createEntityBase(),
        workoutSessionId: session.id,
        exerciseId: item.exercise.id,
        exerciseName: item.exercise.name,
        order: setNumber,
        setType: 'working',
        weight: null,
        reps: null,
        rir: null,
        completedAt: null,
      })
    }
  }

  await db.transaction(
    'rw',
    db.workoutSessions,
    db.exerciseSets,
    async () => {
      await db.workoutSessions.add(session)
      await db.exerciseSets.bulkAdd(sets)
    },
  )

  const activeWorkout = await getActiveWorkout()

  if (!activeWorkout) {
    throw new Error('No se ha podido iniciar el entrenamiento.')
  }

  return activeWorkout
}

export async function saveSetDraft(
  setId: string,
  values: {
    weight: number | null
    reps: number | null
    rir: number | null
  },
) {
  const set = await db.exerciseSets.get(setId)

  if (!set) {
    throw new Error('Serie no encontrada.')
  }

  await db.exerciseSets.update(setId, {
    ...values,
    updatedAt: new Date().toISOString(),
    version: set.version + 1,
  })
}

export async function toggleSetCompletion(
  setId: string,
  values: {
    weight: number | null
    reps: number | null
    rir: number | null
  },
): Promise<boolean> {
  const set = await db.exerciseSets.get(setId)

  if (!set) {
    throw new Error('Serie no encontrada.')
  }

  if (set.completedAt !== null) {
    await db.exerciseSets.update(setId, {
      ...values,
      completedAt: null,
      updatedAt: new Date().toISOString(),
      version: set.version + 1,
    })

    return false
  }

  if (values.reps === null || values.reps <= 0) {
    throw new Error(
      'Introduce las repeticiones antes de completar la serie.',
    )
  }

  await db.exerciseSets.update(setId, {
    ...values,
    completedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: set.version + 1,
  })

  return true
}

export async function addExerciseSet(
  workoutSessionId: string,
  exercise: Exercise,
  setType: SetType,
) {
  const currentSets = await db.exerciseSets
    .where('[workoutSessionId+exerciseId]')
    .equals([workoutSessionId, exercise.id])
    .toArray()

  const nextOrder =
    currentSets.reduce(
      (highest, set) => Math.max(highest, set.order),
      0,
    ) + 1

  const newSet: ExerciseSet = {
    ...createEntityBase(),
    workoutSessionId,
    exerciseId: exercise.id,
    exerciseName: exercise.name,
    order: nextOrder,
    setType,
    weight: null,
    reps: null,
    rir: null,
    completedAt: null,
  }

  await db.exerciseSets.add(newSet)
}

export async function removeExerciseSet(setId: string) {
  await db.exerciseSets.delete(setId)
}

export async function finishWorkout(workoutSessionId: string) {
  const session = await db.workoutSessions.get(workoutSessionId)

  if (!session) {
    throw new Error('Entrenamiento no encontrado.')
  }

  const sets = await db.exerciseSets
    .where('workoutSessionId')
    .equals(workoutSessionId)
    .toArray()

  const completedSets = sets.filter(
    (set) => set.completedAt !== null,
  )

  if (completedSets.length === 0) {
    throw new Error(
      'Completa al menos una serie antes de finalizar.',
    )
  }

  await db.workoutSessions.update(workoutSessionId, {
    status: 'completed',
    completedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: session.version + 1,
  })
}

export async function getWorkoutHistory(
  limit = 10,
): Promise<HistorySessionView[]> {
  const sessions = await db.workoutSessions
    .where('status')
    .equals('completed')
    .toArray()

  sessions.sort((a, b) => {
    const dateA = a.completedAt ?? a.startedAt
    const dateB = b.completedAt ?? b.startedAt

    return Date.parse(dateB) - Date.parse(dateA)
  })

  const selectedSessions = sessions.slice(0, limit)

  const result: HistorySessionView[] = []

  for (const session of selectedSessions) {
    const sets = await db.exerciseSets
      .where('workoutSessionId')
      .equals(session.id)
      .toArray()

    result.push({
      session,
      sets: sets
        .filter((set) => set.completedAt !== null)
        .sort((a, b) => {
          if (a.exerciseName === b.exerciseName) {
            return a.order - b.order
          }

          return a.exerciseName.localeCompare(b.exerciseName)
        }),
    })
  }

  return result
} 

export async function cancelWorkout(
  workoutSessionId: string,
) {
  const session = await db.workoutSessions.get(
    workoutSessionId,
  )

  if (!session) {
    throw new Error('Entrenamiento no encontrado.')
  }

  await db.workoutSessions.update(
    workoutSessionId,
    {
      status: 'cancelled',
      completedAt: null,
      updatedAt: new Date().toISOString(),
      version: session.version + 1,
    },
  )
}