import Dexie, {
  type Table,
} from 'dexie'

import type {
  Exercise,
  ExerciseSet,
  PlannedWorkoutSession,
  WorkoutSession,
  WorkoutSessionExercise,
  WorkoutTemplate,
  WorkoutTemplateExercise,
} from '../types/training'

import type {
  DailyMeal,
  Ingredient,
  NutritionDay,
  NutritionGoal,
  Recipe,
  RecipeIngredient,
  ShoppingItem,
  WeeklyNutritionPlan,
  WeeklyNutritionPlanMeal,
} from '../types/nutrition'

import type {
  BodyMeasurement,
  ProgressFeaturedExercise,
  ProgressGoal,
  WeightEntry,
} from '../types/progress'

import type {
  DailyRoutine,
  DailyRoutineTask,
  DailyRoutineTemplate,
  DailyRoutineTemplateItem,
  WorkShift,
} from '../types/today'

export const CURRENT_SCHEMA_VERSION = 5

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
   * Training vNext
   */

  plannedWorkoutSessions!: Table<
    PlannedWorkoutSession,
    string
  >

  workoutSessionExercises!: Table<
    WorkoutSessionExercise,
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
   * Nutrition vNext
   */

  nutritionDays!: Table<
    NutritionDay,
    string
  >

  dailyMeals!: Table<
    DailyMeal,
    string
  >

  nutritionGoals!: Table<
    NutritionGoal,
    string
  >

  weeklyNutritionPlans!: Table<
    WeeklyNutritionPlan,
    string
  >

  weeklyNutritionPlanMeals!: Table<
    WeeklyNutritionPlanMeal,
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

  /*
   * Progreso vNext
   */

  weightEntries!: Table<
    WeightEntry,
    string
  >

  bodyMeasurements!: Table<
    BodyMeasurement,
    string
  >

  progressGoals!: Table<
    ProgressGoal,
    string
  >

  progressFeaturedExercises!: Table<
    ProgressFeaturedExercise,
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
     */
    this.version(4).stores({
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

    /*
     * FÉNIX DB v5
     *
     * Fundación conjunta:
     * Training vNext
     * Nutrition vNext
     * Progreso vNext
     *
     * Migración deliberadamente
     * aditiva.
     *
     * No elimina tablas ni registros
     * de las versiones anteriores.
     */
    this.version(5).stores({
      appMeta:
        '&key, updatedAt',

      /*
       * Training existente
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
       * Training vNext
       */
      plannedWorkoutSessions:
        '&id, workoutTemplateId, originalScheduledDate, scheduledDate, status, executionSessionId, [scheduledDate+status], deletedAt, updatedAt',

      workoutSessionExercises:
        '&id, workoutSessionId, exerciseId, order, [workoutSessionId+order], sourceTemplateExerciseId, substitutedFromExerciseId, deletedAt, updatedAt',

      /*
       * Nutrition existente
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
       * Nutrition vNext
       */
      nutritionDays:
        '&id, &date, appetiteMode, deletedAt, updatedAt',

      dailyMeals:
        '&id, date, role, status, trainingSessionId, recipeId, order, [date+order], [date+status], [trainingSessionId+status], deletedAt, updatedAt',

      nutritionGoals:
        '&id, startsOn, endsOn, deletedAt, updatedAt',

      weeklyNutritionPlans:
        '&id, name, isActive, deletedAt, updatedAt',

      weeklyNutritionPlanMeals:
        '&id, weeklyPlanId, dayOfWeek, role, order, recipeId, [weeklyPlanId+dayOfWeek+order], deletedAt, updatedAt',

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

      /*
       * Progreso vNext
       */
      weightEntries:
        '&id, date, recordedAt, comparable, deletedAt, updatedAt',

      bodyMeasurements:
        '&id, date, recordedAt, deletedAt, updatedAt',

      progressGoals:
        '&id, kind, startsOn, endsOn, isActive, deletedAt, updatedAt',

      progressFeaturedExercises:
        '&id, exerciseId, order, deletedAt, updatedAt',
    })
  }
}

export const db =
  new FenixDatabase()

export async function initializeDatabase() {
  await db.open()

  await db.appMeta.put({
    key: 'schemaVersion',
    value: String(CURRENT_SCHEMA_VERSION),
    updatedAt:
      new Date().toISOString(),
  })
}