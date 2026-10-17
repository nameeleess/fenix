import { db } from '../db/database'
import { ensureTrainingVNextMigration } from './trainingVNextMigration'
import type {
  NutritionDataQuality,
  NutritionRole,
  Recipe,
  RecipeType,
} from '../types/nutrition'

const NUTRITION_VNEXT_MIGRATION_VERSION = '1'

function entityBase(id: string = crypto.randomUUID()) {
  const now = new Date().toISOString()

  return {
    id,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    version: 1,
  }
}

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function recipeTypeFor(recipe: Recipe): RecipeType {
  if (recipe.category === 'breakfast') {
    return 'breakfast'
  }

  if (recipe.category === 'main_meal') {
    return 'dish'
  }

  if (recipe.category === 'shake') {
    return 'shake'
  }

  if (
    recipe.category === 'preworkout' ||
    recipe.category === 'work_snack' ||
    recipe.category === 'bedtime'
  ) {
    return 'snack'
  }

  return 'other'
}

function compatibleRolesFor(recipe: Recipe): NutritionRole[] {
  if (recipe.category === 'breakfast') {
    return ['breakfast', 'postworkout']
  }

  if (recipe.category === 'preworkout') {
    return ['preworkout']
  }

  if (recipe.category === 'work_snack') {
    return ['snack']
  }

  if (recipe.category === 'main_meal') {
    return ['main_meal', 'dinner']
  }

  if (recipe.category === 'bedtime') {
    return ['snack', 'dinner']
  }

  if (recipe.category === 'shake') {
    return ['postworkout', 'snack']
  }

  return ['extra']
}

function dataQualityFor(recipe: Recipe): NutritionDataQuality {
  const values = [
    recipe.estimatedCalories,
    recipe.estimatedProtein,
    recipe.estimatedCarbs,
    recipe.estimatedFat,
  ]

  if (values.every((value) => value !== null)) {
    return 'estimated'
  }

  if (values.some((value) => value !== null)) {
    return 'partial'
  }

  return 'unknown'
}

async function ensureNutritionVNextMigration() {
  const meta = await db.appMeta.get('nutritionVNextMigrationVersion')

  if (meta?.value === NUTRITION_VNEXT_MIGRATION_VERSION) {
    return
  }

  await db.transaction(
    'rw',
    db.appMeta,
    db.recipes,
    db.nutritionGoals,
    async () => {
      const recipes = await db.recipes.toArray()

      for (const recipe of recipes) {
        if (recipe.deletedAt !== null) {
          continue
        }

        const patch: Partial<Recipe> = {}

        if (recipe.recipeType === undefined) {
          patch.recipeType = recipeTypeFor(recipe)
        }

        if (recipe.compatibleRoles === undefined) {
          patch.compatibleRoles = compatibleRolesFor(recipe)
        }

        if (recipe.volumeClass === undefined) {
          /*
           * No inferimos volumen a partir de calorías.
           * "normal" es un punto neutro editable.
           */
          patch.volumeClass = 'normal'
        }

        if (recipe.basePortion === undefined) {
          patch.basePortion = 1
        }

        if (recipe.nutritionDataQuality === undefined) {
          patch.nutritionDataQuality = dataQualityFor(recipe)
        }

        if (Object.keys(patch).length > 0) {
          await db.recipes.update(recipe.id, {
            ...patch,
            updatedAt: new Date().toISOString(),
            version: recipe.version + 1,
          })
        }
      }

      const existingGoals = (await db.nutritionGoals.toArray()).filter(
        (goal) => goal.deletedAt === null && goal.endsOn === null,
      )

      if (existingGoals.length === 0) {
        await db.nutritionGoals.add({
          ...entityBase('nutrition-goal-initial-vnext'),
          startsOn: getLocalDateKey(),
          endsOn: null,
          targetCalories: 2850,
          targetProtein: 130,
          targetCarbs: null,
          targetFat: null,
          targetWeightGainMinKgPerWeek: null,
          targetWeightGainMaxKgPerWeek: null,
          notes:
            'Objetivo operativo inicial. El ritmo objetivo de ganancia queda sin definir hasta que Nutrition lo establezca explícitamente.',
        })
      }

      await db.appMeta.put({
        key: 'nutritionVNextMigrationVersion',
        value: NUTRITION_VNEXT_MIGRATION_VERSION,
        updatedAt: new Date().toISOString(),
      })
    },
  )
}

export async function ensureVNextDataMigrations() {
  await ensureTrainingVNextMigration()
  await ensureNutritionVNextMigration()
}
