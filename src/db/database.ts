import Dexie, {
  type Table,
} from 'dexie'

import type {
  Exercise,
  ExerciseSet,
  WorkoutSession,
  WorkoutTemplate,
  WorkoutTemplateExercise,
} from '../types/training'

import type {
  Ingredient,
  Recipe,
  RecipeIngredient,
  ShoppingItem,
} from '../types/nutrition'

import type {
  DailyRoutine,
  DailyRoutineTask,
  DailyRoutineTemplate,
  DailyRoutineTemplateItem,
  WorkShift,
} from '../types/today'

export interface AppMeta {
  key: string

  value: string

  updatedAt: string
}

class FenixDatabase extends Dexie {
  appMeta!: Table<
    AppMeta,
    string
  >

  /*
   * Training
   */

  exercises!: Table<
    Exercise,
    string
  >

  workoutTemplates!: Table<
    WorkoutTemplate,
    string
  >

  workoutTemplateExercises!: Table<
    WorkoutTemplateExercise,
    string
  >

  workoutSessions!: Table<
    WorkoutSession,
    string
  >

  exerciseSets!: Table<
    ExerciseSet,
    string
  >

  /*
   * Nutrition
   */

  ingredients!: Table<
    Ingredient,
    string
  >

  recipes!: Table<
    Recipe,
    string
  >

  recipeIngredients!: Table<
    RecipeIngredient,
    string
  >

  shoppingItems!: Table<
    ShoppingItem,
    string
  >

  /*
   * Hoy / Rutina
   */

  dailyRoutineTemplates!: Table<
    DailyRoutineTemplate,
    string
  >

  dailyRoutineTemplateItems!: Table<
    DailyRoutineTemplateItem,
    string
  >

  dailyRoutines!: Table<
    DailyRoutine,
    string
  >

  dailyRoutineTasks!: Table<
    DailyRoutineTask,
    string
  >

  workShifts!: Table<
    WorkShift,
    string
  >

  constructor() {
    super('fenix-db')

    /*
     * FÉNIX DB v1
     * Fundación inicial.
     */
    this.version(1).stores({
      appMeta:
        '&key, updatedAt',
    })

    /*
     * FÉNIX DB v2
     * Training.
     */
    this.version(2).stores({
      appMeta:
        '&key, updatedAt',

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

    /*
     * FÉNIX DB v3
     * Nutrition.
     *
     * Conservamos todas las tablas
     * existentes de Training y añadimos
     * las tablas nutricionales.
     */
    this.version(3).stores({
      appMeta:
        '&key, updatedAt',

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

      ingredients:
        '&id, name, category, deletedAt, updatedAt',

      recipes:
        '&id, name, category, deletedAt, updatedAt',

      recipeIngredients:
        '&id, recipeId, ingredientId, order, [recipeId+order], [recipeId+ingredientId], deletedAt',

      shoppingItems:
        '&id, ingredientId, addedAt, deletedAt, updatedAt',
    })

    /*
     * FÉNIX DB v4
     * Hoy / Rutina.
     *
     * Esta migración es aditiva:
     * NO modifica ni elimina las tablas
     * existentes de Training o Nutrition.
     *
     * Añade:
     *
     * - plantillas de rutina;
     * - elementos de plantilla;
     * - ejecución diaria;
     * - tareas históricas por fecha;
     * - turnos laborales por fecha.
     */
    this.version(4).stores({
      appMeta:
        '&key, updatedAt',

      /*
       * Training
       */
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

      /*
       * Nutrition
       */
      ingredients:
        '&id, name, category, deletedAt, updatedAt',

      recipes:
        '&id, name, category, deletedAt, updatedAt',

      recipeIngredients:
        '&id, recipeId, ingredientId, order, [recipeId+order], [recipeId+ingredientId], deletedAt',

      shoppingItems:
        '&id, ingredientId, addedAt, deletedAt, updatedAt',

      /*
       * Hoy / Rutina
       */
      dailyRoutineTemplates:
        '&id, name, deletedAt, updatedAt',

      dailyRoutineTemplateItems:
        '&id, templateId, block, order, [templateId+block+order], applicability, deletedAt, updatedAt',

      dailyRoutines:
        '&id, &date, templateId, startedAt, deletedAt, updatedAt',

      dailyRoutineTasks:
        '&id, dailyRoutineId, date, block, status, order, [dailyRoutineId+block+order], sourceTemplateItemId, kind, deletedAt, updatedAt',

      workShifts:
        '&id, &date, status, deletedAt, updatedAt',
    })
  }
}

export const db =
  new FenixDatabase()

export async function initializeDatabase() {
  await db.open()

  await db.appMeta.put({
    key: 'schemaVersion',
    value: '4',
    updatedAt:
      new Date().toISOString(),
  })
}