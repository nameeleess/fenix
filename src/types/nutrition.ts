import type { BaseEntity } from './common'

/*
 * Taxonomía histórica.
 *
 * Se mantiene porque las recetas
 * actuales dependen de ella.
 * vNext utilizará además tipo,
 * roles compatibles y volumen.
 */
export type NutritionCategory =
  | 'breakfast'
  | 'preworkout'
  | 'work_snack'
  | 'main_meal'
  | 'bedtime'
  | 'shake'

export type NutritionRole =
  | 'breakfast'
  | 'preworkout'
  | 'postworkout'
  | 'main_meal'
  | 'snack'
  | 'dinner'
  | 'extra'

export type RecipeType =
  | 'dish'
  | 'breakfast'
  | 'snack'
  | 'shake'
  | 'other'

export type AppetiteMode =
  | 'compact'
  | 'normal'
  | 'voluminous'

export type MealStatus =
  | 'pending'
  | 'completed'
  | 'skipped'

export type NutritionDataQuality =
  | 'known'
  | 'estimated'
  | 'partial'
  | 'unknown'

export type IngredientCategory =
  | 'protein'
  | 'fat'
  | 'carbohydrate'
  | 'dairy'
  | 'fruit_vegetable'
  | 'pantry'
  | 'supplement'
  | 'other'

export type PreparationState =
  | 'dry'
  | 'cooked'
  | 'drained'

export interface Ingredient
  extends BaseEntity {
  name: string

  category: IngredientCategory

  defaultUnit: string | null

  notes: string | null

  caloriesPerBase?: number | null

  proteinPerBase?: number | null

  carbsPerBase?: number | null

  fatPerBase?: number | null

  nutritionBaseQuantity?: number | null

  nutritionBaseUnit?: string | null

  nutritionDataQuality?: NutritionDataQuality
}

export interface Recipe
  extends BaseEntity {
  name: string

  /*
   * Categoría legacy.
   */
  category: NutritionCategory

  instructions: string | null

  estimatedCalories: number | null

  estimatedProtein: number | null

  estimatedCarbs: number | null

  estimatedFat: number | null

  isFavorite: boolean

  notes: string | null

  /*
   * Campos vNext.
   */
  recipeType?: RecipeType

  compatibleRoles?: NutritionRole[]

  volumeClass?: AppetiteMode

  basePortion?: number | null

  nutritionDataQuality?: NutritionDataQuality
}

export interface RecipeIngredient
  extends BaseEntity {
  recipeId: string

  ingredientId: string

  order: number

  quantity: number | null

  quantityMax: number | null

  unit: string | null

  preparationState:
    | PreparationState
    | null

  notes: string | null
}

export interface ShoppingItem
  extends BaseEntity {
  ingredientId: string

  quantity: number | null

  quantityMax: number | null

  unit: string | null

  checked: boolean

  addedAt: string
}

/*
 * Contexto nutricional de una fecha.
 */
export interface NutritionDay
  extends BaseEntity {
  date: string

  appetiteMode: AppetiteMode

  appliedWeeklyPlanId: string | null

  notes: string | null
}

/*
 * Unidad operativa central de
 * Nutrition vNext.
 *
 * Receta y comida diaria son
 * entidades distintas.
 */
export interface DailyMeal
  extends BaseEntity {
  date: string

  role: NutritionRole

  order: number

  status: MealStatus

  /*
   * Identidad de PlannedWorkoutSession.
   * Solo se utiliza cuando el rol está
   * realmente vinculado a Training.
   */
  trainingSessionId: string | null

  recipeId: string | null

  /*
   * Snapshot del nombre mostrado en
   * esa instancia concreta.
   */
  name: string

  isImprovised: boolean

  portionMultiplier: number | null

  plannedQuantity: number | null

  plannedUnit: string | null

  plannedCalories: number | null

  plannedProtein: number | null

  plannedCarbs: number | null

  plannedFat: number | null

  plannedDataQuality: NutritionDataQuality

  confirmedQuantity: number | null

  confirmedUnit: string | null

  confirmedCalories: number | null

  confirmedProtein: number | null

  confirmedCarbs: number | null

  confirmedFat: number | null

  confirmedDataQuality: NutritionDataQuality

  confirmedAt: string | null

  skippedAt: string | null

  notes: string | null

  /* Metadatos de snapshot vNext. */
  sourceRecipeVersion?: number | null

  planningSource?: 'auto' | 'weekly' | 'manual'
}

/*
 * Objetivo nutricional con vigencia.
 *
 * Los valores iniciales se crearán
 * posteriormente mediante el seed
 * aprobado, nunca hardcodeados en UI.
 */
export interface NutritionGoal
  extends BaseEntity {
  startsOn: string

  endsOn: string | null

  targetCalories: number | null

  targetProtein: number | null

  targetCarbs: number | null

  targetFat: number | null

  targetWeightGainMinKgPerWeek:
    number | null

  targetWeightGainMaxKgPerWeek:
    number | null

  notes: string | null
}

/*
 * Propuesta semanal reutilizable.
 */
export interface WeeklyNutritionPlan
  extends BaseEntity {
  name: string

  description: string | null

  isActive: boolean
}

export interface WeeklyNutritionPlanMeal
  extends BaseEntity {
  weeklyPlanId: string

  /*
   * 0 = domingo
   * 1 = lunes
   * ...
   * 6 = sábado
   */
  dayOfWeek: number

  role: NutritionRole

  order: number

  recipeId: string | null

  portionMultiplier: number | null

  notes: string | null
}