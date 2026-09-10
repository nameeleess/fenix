import { db } from '../db/database'
import { getLocalDateKey } from '../utils/date'
import { createUuid } from '../utils/uuid'
import type {
  WorkoutSessionExercise,
  WorkoutTemplateExercise,
} from '../types/training'
import type {
  NutritionDataQuality,
  NutritionRole,
  Recipe,
  RecipeType,
} from '../types/nutrition'

const TRAINING_VNEXT_MIGRATION_VERSION = '1'
const NUTRITION_VNEXT_MIGRATION_VERSION = '1'

function entityBase(id: string = createUuid()) {
  const now = new Date().toISOString()

  return {
    id,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    version: 1,
  }
}

function getTargetRirRange(config: WorkoutTemplateExercise | undefined) {
  if (!config) {
    return {
      min: null,
      max: null,
    }
  }

  const min = config.targetRirMin ?? config.targetRir ?? null
  const max = config.targetRirMax ?? config.targetRir ?? null

  return { min, max }
}

async function ensureTrainingVNextMigration() {
  const meta = await db.appMeta.get('trainingVNextMigrationVersion')

  if (meta?.value === TRAINING_VNEXT_MIGRATION_VERSION) {
    return
  }

  await db.transaction(
    'rw',
    db.appMeta,
    db.workoutSessions,
    db.workoutTemplateExercises,
    db.workoutSessionExercises,
    db.exerciseSets,
    async () => {
      const [sessions, templateConfigs] = await Promise.all([
        db.workoutSessions.toArray(),
        db.workoutTemplateExercises.toArray(),
      ])

      for (const session of sessions) {
        if (session.deletedAt !== null) {
          continue
        }

        const existingSnapshots = await db.workoutSessionExercises
          .where('workoutSessionId')
          .equals(session.id)
          .toArray()

        const sets = (await db.exerciseSets
          .where('workoutSessionId')
          .equals(session.id)
          .toArray())
          .filter((set) => set.deletedAt === null)

        if (sets.length === 0) {
          continue
        }

        const snapshotsByExerciseId = new Map(
          existingSnapshots
            .filter((item) => item.deletedAt === null)
            .map((item) => [item.exerciseId, item]),
        )

        const exerciseIds: string[] = []

        for (const set of sets) {
          if (!exerciseIds.includes(set.exerciseId)) {
            exerciseIds.push(set.exerciseId)
          }
        }

        for (const exerciseId of exerciseIds) {
          let snapshot = snapshotsByExerciseId.get(exerciseId)

          if (!snapshot) {
            const matchingSets = sets
              .filter((set) => set.exerciseId === exerciseId)
              .sort((a, b) => a.order - b.order)

            const config = templateConfigs.find(
              (item) =>
                item.deletedAt === null &&
                item.workoutTemplateId === session.workoutTemplateId &&
                item.exerciseId === exerciseId,
            )

            const rir = getTargetRirRange(config)
            const firstSet = matchingSets[0]

            const next: WorkoutSessionExercise = {
              ...entityBase(),
              workoutSessionId: session.id,
              sourceTemplateExerciseId: config?.id ?? null,
              exerciseId,
              exerciseName: firstSet?.exerciseName ?? exerciseId,
              order: config?.order ?? exerciseIds.indexOf(exerciseId) + 1,
              targetSets:
                config?.targetSets ??
                matchingSets.filter((set) => set.setType === 'working').length,
              minReps: config?.minReps ?? 0,
              maxReps: config?.maxReps ?? 0,
              targetRirMin: rir.min,
              targetRirMax: rir.max,
              restSeconds: config?.restSeconds ?? 90,
              substitutedFromExerciseId: null,
              notes: null,
            }

            await db.workoutSessionExercises.add(next)
            snapshot = next
            snapshotsByExerciseId.set(exerciseId, next)
          }

          for (const set of sets.filter((item) => item.exerciseId === exerciseId)) {
            if (set.workoutSessionExerciseId === snapshot.id) {
              continue
            }

            await db.exerciseSets.update(set.id, {
              workoutSessionExerciseId: snapshot.id,
              updatedAt: new Date().toISOString(),
              version: set.version + 1,
            })
          }
        }
      }

      const planningStart = await db.appMeta.get('trainingPlanningStartDate')

      if (!planningStart) {
        await db.appMeta.put({
          key: 'trainingPlanningStartDate',
          value: getLocalDateKey(),
          updatedAt: new Date().toISOString(),
        })
      }

      await db.appMeta.put({
        key: 'trainingVNextMigrationVersion',
        value: TRAINING_VNEXT_MIGRATION_VERSION,
        updatedAt: new Date().toISOString(),
      })
    },
  )
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
