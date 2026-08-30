import Dexie, { type Table } from 'dexie'
import type {
  Exercise,
  ExerciseSet,
  WorkoutSession,
  WorkoutTemplate,
  WorkoutTemplateExercise,
} from '../types/training'

export interface AppMeta {
  key: string
  value: string
  updatedAt: string
}

class FenixDatabase extends Dexie {
  appMeta!: Table<AppMeta, string>

  exercises!: Table<Exercise, string>
  workoutTemplates!: Table<WorkoutTemplate, string>
  workoutTemplateExercises!: Table<WorkoutTemplateExercise, string>
  workoutSessions!: Table<WorkoutSession, string>
  exerciseSets!: Table<ExerciseSet, string>

  constructor() {
    super('fenix-db')

    // Base inicial que ya existe en tu ordenador.
    this.version(1).stores({
      appMeta: '&key, updatedAt',
    })

    // Training real.
    this.version(2).stores({
      appMeta: '&key, updatedAt',

      exercises:
        '&id, name, primaryMuscle, exerciseType, deletedAt, updatedAt',

      workoutTemplates:
        '&id, name, dayOfWeek, type, deletedAt, updatedAt',

      workoutTemplateExercises:
        '&id, workoutTemplateId, exerciseId, order, [workoutTemplateId+order], deletedAt',

      workoutSessions:
        '&id, workoutTemplateId, status, startedAt, completedAt, updatedAt',

      exerciseSets:
        '&id, workoutSessionId, exerciseId, setType, order, completedAt, [workoutSessionId+exerciseId], updatedAt',
    })
  }
}

export const db = new FenixDatabase()

export async function initializeDatabase() {
  await db.open()

  await db.appMeta.put({
    key: 'schemaVersion',
    value: '2',
    updatedAt: new Date().toISOString(),
  })
}