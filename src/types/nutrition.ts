import type { BaseEntity } from './common'

export type NutritionCategory =
  | 'breakfast'
  | 'preworkout'
  | 'work_snack'
  | 'main_meal'
  | 'bedtime'
  | 'shake'

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
}

export interface Recipe
  extends BaseEntity {
  name: string

  category: NutritionCategory

  instructions: string | null

  estimatedCalories: number | null

  estimatedProtein: number | null

  estimatedCarbs: number | null

  estimatedFat: number | null

  isFavorite: boolean

  notes: string | null
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