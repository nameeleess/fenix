import { db } from '../../db/database'
import { publishCommittedMutation } from '../../app/freshnessEvents'
import { createKeyedSerialQueue } from '../../app/keyedSerialQueue'

import type {
  AppetiteMode,
  DailyMeal,
  MealStatus,
  NutritionDataQuality,
  NutritionDay,
  NutritionGoal,
  NutritionRole,
  Recipe,
} from '../../types/nutrition'

import type {
  PlannedWorkoutSession,
} from '../../types/training'

import {
  dailyMealIdentityKey,
  dailyMealMatchesIdentity,
  planPendingTrainingMealReconciliation,
} from './dailyMealIdentity'

import {
  chooseRecipeForAppetite,
} from './nutritionAppetitePolicy'

export interface MacroSummary {
  calories: number
  protein: number
  carbs: number
  fat: number
  hasUnknown: boolean
}

export interface NutritionMealView {
  meal: DailyMeal
  recipe: Recipe | null
  alternatives: Recipe[]
}

export interface NutritionDayView {
  date: string
  day: NutritionDay
  /** Compatibility focus only. trainingSessions is the non-destructive source. */
  trainingSession: PlannedWorkoutSession | null
  trainingSessions: PlannedWorkoutSession[]
  meals: NutritionMealView[]
  goal: NutritionGoal | null
  planned: MacroSummary
  consumed: MacroSummary
}

export interface NutritionWeekDaySuggestion {
  date: string
  /** Compatibility focus only. trainingSessions is the non-destructive source. */
  trainingSession: PlannedWorkoutSession | null
  trainingSessions: PlannedWorkoutSession[]
  appetiteMode: AppetiteMode
  meals: Array<{
    role: NutritionRole
    recipe: Recipe | null
    portionMultiplier: number
    trainingSessionId: string | null
  }>
  planned: MacroSummary
}

export interface NutritionWeekSuggestion {
  monday: string
  days: NutritionWeekDaySuggestion[]
  goal: NutritionGoal | null
}

export interface ImprovisedMealInput {
  submissionId: string
  name: string
  role: NutritionRole
  calories: number | null
  protein: number | null
  carbs: number | null
  fat: number | null
}

export interface NutritionGoalInput {
  targetCalories: number | null
  targetProtein: number | null
  targetCarbs: number | null
  targetFat: number | null
  targetWeightGainMinKgPerWeek: number | null
  targetWeightGainMaxKgPerWeek: number | null
}

const nutritionDayReadQueue = createKeyedSerialQueue()
const nutritionTrainingReconciliationQueue = createKeyedSerialQueue()
const NUTRITION_TRAINING_RECONCILIATION_KEY = 'global-training-meal-reconciliation'

const roleLabels: Record<NutritionRole, string> = {
  breakfast: 'Desayuno',
  preworkout: 'Pre-entreno',
  postworkout: 'Post-entreno',
  main_meal: 'Comida principal',
  snack: 'Snack',
  dinner: 'Cena',
  extra: 'Extra',
}

const roleOrder: Record<NutritionRole, number> = {
  preworkout: 1,
  postworkout: 2,
  breakfast: 2,
  main_meal: 3,
  snack: 4,
  dinner: 5,
  extra: 6,
}

function createBase(id: string = crypto.randomUUID()) {
  const now = new Date().toISOString()

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
  return new Date(year, month - 1, day, 12)
}

function shiftDateKey(dateKey: string, days: number) {
  const date = parseDateKey(dateKey)
  date.setDate(date.getDate() + days)
  return getLocalDateKey(date)
}

export function getMonday(dateKey: string) {
  const date = parseDateKey(dateKey)
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff)
  return getLocalDateKey(date)
}

function nonTrainingRolesFor(hasTraining: boolean) {
  if (hasTraining) {
    return [
      'main_meal',
      'snack',
      'dinner',
    ] satisfies NutritionRole[]
  }

  return [
    'breakfast',
    'main_meal',
    'snack',
    'dinner',
  ] satisfies NutritionRole[]
}

function compareNutritionTrainingSessions(
  a: PlannedWorkoutSession,
  b: PlannedWorkoutSession,
) {
  const byDate = a.scheduledDate.localeCompare(b.scheduledDate)
  if (byDate !== 0) return byDate

  const byCreatedAt = a.createdAt.localeCompare(b.createdAt)
  if (byCreatedAt !== 0) return byCreatedAt

  return a.id.localeCompare(b.id)
}

function activeFormalTrainingSessions(
  sessions: readonly PlannedWorkoutSession[],
  date?: string,
) {
  return sessions
    .filter(
      (session) =>
        session.deletedAt === null &&
        session.isFormalStrength &&
        !session.isExtra &&
        session.status !== 'omitted' &&
        (!date || session.scheduledDate === date),
    )
    .sort(compareNutritionTrainingSessions)
}

interface DesiredMealSpec {
  role: NutritionRole
  trainingSessionId: string | null
}

function desiredMealSpecsForDate(
  trainingSessions: readonly PlannedWorkoutSession[],
): DesiredMealSpec[] {
  const specs: DesiredMealSpec[] = []

  for (const session of trainingSessions) {
    specs.push(
      { role: 'preworkout', trainingSessionId: session.id },
      { role: 'postworkout', trainingSessionId: session.id },
    )
  }

  for (const role of nonTrainingRolesFor(trainingSessions.length > 0)) {
    specs.push({ role, trainingSessionId: null })
  }

  return specs
}

function qualityFor(recipe: Recipe | null): NutritionDataQuality {
  if (!recipe) {
    return 'unknown'
  }

  if (recipe.nutritionDataQuality) {
    return recipe.nutritionDataQuality
  }

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

function scale(value: number | null, multiplier: number) {
  return value === null ? null : Math.round(value * multiplier * 10) / 10
}

function macroSummaryFromMeals(
  meals: DailyMeal[],
  mode: 'planned' | 'confirmed',
): MacroSummary {
  let calories = 0
  let protein = 0
  let carbs = 0
  let fat = 0
  let hasUnknown = false

  for (const meal of meals) {
    if (meal.deletedAt !== null) {
      continue
    }

    if (mode === 'confirmed' && meal.status !== 'completed') {
      continue
    }

    const values =
      mode === 'planned'
        ? [
            meal.plannedCalories,
            meal.plannedProtein,
            meal.plannedCarbs,
            meal.plannedFat,
          ]
        : [
            meal.confirmedCalories,
            meal.confirmedProtein,
            meal.confirmedCarbs,
            meal.confirmedFat,
          ]

    const [mealCalories, mealProtein, mealCarbs, mealFat] = values

    if (values.some((value) => value === null)) {
      hasUnknown = true
    }

    calories += mealCalories ?? 0
    protein += mealProtein ?? 0
    carbs += mealCarbs ?? 0
    fat += mealFat ?? 0
  }

  return {
    calories: Math.round(calories * 10) / 10,
    protein: Math.round(protein * 10) / 10,
    carbs: Math.round(carbs * 10) / 10,
    fat: Math.round(fat * 10) / 10,
    hasUnknown,
  }
}

function buildMeal(
  date: string,
  role: NutritionRole,
  recipe: Recipe | null,
  trainingSessionId: string | null,
  portionMultiplier = 1,
): DailyMeal {
  const quality = qualityFor(recipe)

  return {
    ...createBase(),
    date,
    role,
    order: roleOrder[role],
    status: 'pending',
    trainingSessionId:
      role === 'preworkout' || role === 'postworkout'
        ? trainingSessionId
        : null,
    recipeId: recipe?.id ?? null,
    name: recipe?.name ?? roleLabels[role],
    isImprovised: false,
    portionMultiplier,
    plannedQuantity: portionMultiplier,
    plannedUnit: 'ración',
    plannedCalories: scale(recipe?.estimatedCalories ?? null, portionMultiplier),
    plannedProtein: scale(recipe?.estimatedProtein ?? null, portionMultiplier),
    plannedCarbs: scale(recipe?.estimatedCarbs ?? null, portionMultiplier),
    plannedFat: scale(recipe?.estimatedFat ?? null, portionMultiplier),
    plannedDataQuality: quality,
    confirmedQuantity: null,
    confirmedUnit: null,
    confirmedCalories: null,
    confirmedProtein: null,
    confirmedCarbs: null,
    confirmedFat: null,
    confirmedDataQuality: 'unknown',
    confirmedAt: null,
    skippedAt: null,
    notes: null,
    sourceRecipeVersion: recipe?.version ?? null,
    planningSource: 'auto',
  }
}

function activeGoalFrom(
  goals: readonly NutritionGoal[],
) {
  const active = goals
    .filter((goal) => goal.deletedAt === null && goal.endsOn === null)
    .sort(
      (a, b) =>
        a.startsOn.localeCompare(b.startsOn) ||
        a.createdAt.localeCompare(b.createdAt) ||
        a.id.localeCompare(b.id),
    )

  if (active.length > 1) {
    throw new Error(
      `Integridad Nutrition: existen ${active.length} objetivos activos simultáneos.`,
    )
  }

  return active[0] ?? null
}

async function getActiveGoal() {
  return activeGoalFrom(await db.nutritionGoals.toArray())
}


async function reconcilePendingTrainingMeals() {
  return nutritionTrainingReconciliationQueue.run(
    NUTRITION_TRAINING_RECONCILIATION_KEY,
    async () => {
      const changed = await db.transaction(
        'rw',
        db.plannedWorkoutSessions,
        db.dailyMeals,
        async () => {
          // Snapshot, deterministic planning and writes share one IndexedDB
          // transaction. A Training write cannot commit between the session
          // snapshot and these meal writes because both touch
          // plannedWorkoutSessions.
          const [sessions, meals] = await Promise.all([
            db.plannedWorkoutSessions.toArray(),
            db.dailyMeals.toArray(),
          ])

          const reconciliationPlan = planPendingTrainingMealReconciliation(
            meals,
            sessions,
          )

          if (reconciliationPlan.length === 0) {
            return false
          }

          const mealMap = new Map(meals.map((meal) => [meal.id, meal]))
          const now = new Date().toISOString()
          let appliedChanges = 0

          for (const action of reconciliationPlan) {
            const meal = mealMap.get(action.mealId)

            if (!meal) {
              continue
            }

            if (action.type === 'soft-delete') {
              const updated = await db.dailyMeals.update(meal.id, {
                deletedAt: now,
                updatedAt: now,
                version: meal.version + 1,
              })
              appliedChanges += updated
              continue
            }

            const updated = await db.dailyMeals.update(meal.id, {
              date: action.targetDate,
              updatedAt: now,
              version: meal.version + 1,
            })
            appliedChanges += updated
          }

          return appliedChanges > 0
        },
      )

      // Dexie resolves the transaction promise only after commit. Publishing
      // here therefore cannot expose a pre-commit reconciliation. A no-op
      // reconciliation emits nothing and cannot self-sustain a refresh loop.
      if (changed) {
        publishCommittedMutation('nutrition')
      }

      return changed
    },
  )
}

async function ensureNutritionDayEntity(date: string) {
  return db.transaction('rw', db.nutritionDays, async () => {
    const existing = await db.nutritionDays.where('date').equals(date).first()

    if (existing && existing.deletedAt === null) {
      return existing
    }

    const day: NutritionDay = {
      ...createBase(),
      date,
      appetiteMode: 'normal',
      appliedWeeklyPlanId: null,
      notes: null,
    }

    await db.nutritionDays.add(day)
    return day
  })
}

async function ensureDayStructure(
  date: string,
  day: NutritionDay,
  recipes: Recipe[],
) {
  const now = new Date().toISOString()

  return db.transaction(
    'rw',
    db.plannedWorkoutSessions,
    db.dailyMeals,
    async () => {
      const trainingSessions = activeFormalTrainingSessions(
        await db.plannedWorkoutSessions
          .where('scheduledDate')
          .equals(date)
          .toArray(),
        date,
      )
      const desiredSpecs = desiredMealSpecsForDate(trainingSessions)
      const desiredKeys = new Set(
        desiredSpecs.map((spec) =>
          dailyMealIdentityKey(date, spec.role, spec.trainingSessionId),
        ),
      )
      const meals = (await db.dailyMeals.where('date').equals(date).toArray()).filter(
      (meal) => meal.deletedAt === null,
    )

    // Only generated pending structure is disposable here. Manual meals and
    // confirmed/skipped facts are historical/user-owned and remain intact.
    for (const meal of meals) {
      if (meal.status !== 'pending' || meal.planningSource === 'manual') {
        continue
      }

      const identity = dailyMealIdentityKey(
        meal.date,
        meal.role,
        meal.trainingSessionId,
      )

      if (!desiredKeys.has(identity)) {
        await db.dailyMeals.update(meal.id, {
          deletedAt: now,
          updatedAt: now,
          version: meal.version + 1,
        })
      }
    }

    for (const spec of desiredSpecs) {
      // Re-read inside the same write transaction immediately before create.
      // Any active fact/manual meal with this identity owns the slot and must
      // not be replaced by automatic materialization.
      const currentMeals = await db.dailyMeals.where('date').equals(date).toArray()
      const exists = currentMeals.some(
        (meal) =>
          meal.deletedAt === null &&
          dailyMealMatchesIdentity(
            meal,
            date,
            spec.role,
            spec.trainingSessionId,
          ),
      )

      if (exists) {
        continue
      }

      const recipe = chooseRecipeForAppetite(
        recipes,
        spec.role,
        day.appetiteMode,
        date,
        spec.trainingSessionId ?? '',
      )
      await db.dailyMeals.add(
        buildMeal(date, spec.role, recipe, spec.trainingSessionId),
      )
    }

      return trainingSessions
    },
  )
}

async function buildMealViews(date: string, appetiteMode: AppetiteMode) {
  const [meals, recipes] = await Promise.all([
    db.dailyMeals.where('date').equals(date).toArray(),
    db.recipes.toArray(),
  ])

  const activeRecipes = recipes.filter((recipe) => recipe.deletedAt === null)

  return meals
    .filter((meal) => meal.deletedAt === null)
    .sort((a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt))
    .map((meal) => ({
      meal,
      recipe:
        activeRecipes.find((recipe) => recipe.id === meal.recipeId) ?? null,
      alternatives: activeRecipes
        .filter((recipe) => (recipe.compatibleRoles ?? []).includes(meal.role))
        .sort((a, b) => {
          const volumeA = a.volumeClass === appetiteMode ? 0 : 1
          const volumeB = b.volumeClass === appetiteMode ? 0 : 1
          if (volumeA !== volumeB) return volumeA - volumeB
          if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1
          return a.name.localeCompare(b.name, 'es')
        }),
    }))
}

async function getNutritionDaySerialized(
  date: string,
): Promise<NutritionDayView> {
  await reconcilePendingTrainingMeals()

  const [day, recipes, goal] = await Promise.all([
    ensureNutritionDayEntity(date),
    db.recipes.toArray(),
    getActiveGoal(),
  ])

  const trainingSessions = await ensureDayStructure(
    date,
    day,
    recipes.filter((recipe) => recipe.deletedAt === null),
  )

  const meals = await buildMealViews(date, day.appetiteMode)
  const rawMeals = meals.map((item) => item.meal)

  return {
    date,
    day,
    trainingSession: trainingSessions[0] ?? null,
    trainingSessions,
    meals,
    goal,
    planned: macroSummaryFromMeals(rawMeals, 'planned'),
    consumed: macroSummaryFromMeals(rawMeals, 'confirmed'),
  }
}

export async function getNutritionDay(
  date = getLocalDateKey(),
): Promise<NutritionDayView> {
  return nutritionDayReadQueue.run(
    date,
    () => getNutritionDaySerialized(date),
  )
}

export function getRelevantNutritionMeal(
  day: NutritionDayView,
): NutritionMealView | null {
  const pending = day.meals.filter((item) => item.meal.status === 'pending')

  if (pending.length === 0) {
    return null
  }

  const statusPriority: Record<PlannedWorkoutSession['status'], number> = {
    in_progress: 0,
    pending: 1,
    completed: 2,
    incomplete: 2,
    omitted: 3,
  }

  const trainingSessions = [...day.trainingSessions].sort((a, b) => {
    const byStatus = statusPriority[a.status] - statusPriority[b.status]
    if (byStatus !== 0) return byStatus
    return compareNutritionTrainingSessions(a, b)
  })

  for (const session of trainingSessions) {
    if (session.status === 'pending') {
      const preworkout = pending.find(
        (item) =>
          item.meal.role === 'preworkout' &&
          item.meal.trainingSessionId === session.id,
      )
      if (preworkout) return preworkout

      const postworkout = pending.find(
        (item) =>
          item.meal.role === 'postworkout' &&
          item.meal.trainingSessionId === session.id,
      )
      if (postworkout) return postworkout
    }

    if (
      session.status === 'in_progress' ||
      session.status === 'completed' ||
      session.status === 'incomplete'
    ) {
      const postworkout = pending.find(
        (item) =>
          item.meal.role === 'postworkout' &&
          item.meal.trainingSessionId === session.id,
      )
      if (postworkout) return postworkout
    }
  }

  const sequence: NutritionRole[] = [
    'breakfast',
    'main_meal',
    'snack',
    'dinner',
    'extra',
  ]

  for (const role of sequence) {
    const meal = pending.find((item) => item.meal.role === role)
    if (meal) return meal
  }

  // Any remaining Training meal is still tied to its own trainingSessionId;
  // ordering by the day view cannot merge identities.
  return pending[0] ?? null
}

export async function setNutritionDayAppetite(
  date: string,
  appetiteMode: AppetiteMode,
) {
  const changed = await db.transaction(
    'rw',
    db.nutritionDays,
    db.plannedWorkoutSessions,
    db.recipes,
    db.dailyMeals,
    async () => {
      const dayCandidates = (await db.nutritionDays
        .where('date')
        .equals(date)
        .toArray())
        .filter((item) => item.deletedAt === null)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))

      const day = dayCandidates[0]
      let writes = 0
      const now = new Date().toISOString()

      if (day && day.appetiteMode === appetiteMode) {
        return false
      }

      if (!day) {
        await db.nutritionDays.add({
          ...createBase(),
          date,
          appetiteMode,
          appliedWeeklyPlanId: null,
          notes: null,
        })
        writes += 1
      } else if (day.appetiteMode !== appetiteMode) {
        await db.nutritionDays.update(day.id, {
          appetiteMode,
          updatedAt: now,
          version: day.version + 1,
        })
        writes += 1
      }

      const [sessions, recipes, meals] = await Promise.all([
        db.plannedWorkoutSessions
          .where('scheduledDate')
          .equals(date)
          .toArray(),
        db.recipes.toArray(),
        db.dailyMeals.where('date').equals(date).toArray(),
      ])

      const trainingSessions = activeFormalTrainingSessions(sessions, date)
      const desiredSpecs = desiredMealSpecsForDate(trainingSessions)
      const desiredKeys = new Set(
        desiredSpecs.map((spec) =>
          dailyMealIdentityKey(date, spec.role, spec.trainingSessionId),
        ),
      )
      const activeRecipes = recipes.filter((recipe) => recipe.deletedAt === null)
      const activeMeals = meals.filter((meal) => meal.deletedAt === null)

      for (const meal of activeMeals) {
        if (meal.status !== 'pending' || meal.planningSource === 'manual') {
          continue
        }

        const identity = dailyMealIdentityKey(
          meal.date,
          meal.role,
          meal.trainingSessionId,
        )

        if (!desiredKeys.has(identity)) {
          await db.dailyMeals.update(meal.id, {
            deletedAt: now,
            updatedAt: now,
            version: meal.version + 1,
          })
          writes += 1
        }
      }

      for (const spec of desiredSpecs) {
        const sameIdentity = activeMeals
          .filter((meal) =>
            meal.deletedAt === null &&
            dailyMealMatchesIdentity(
              meal,
              date,
              spec.role,
              spec.trainingSessionId,
            ),
          )
          .sort(compareMealStable)

        const protectedFact = sameIdentity.some(
          (meal) => meal.status !== 'pending' || meal.planningSource === 'manual',
        )

        if (protectedFact) {
          continue
        }

        const managed = sameIdentity.filter(
          (meal) => meal.status === 'pending' && meal.planningSource !== 'manual',
        )
        const keeper = managed[0]
        const recipe = chooseRecipeForAppetite(
          activeRecipes,
          spec.role,
          appetiteMode,
          date,
          spec.trainingSessionId ?? '',
          keeper?.recipeId ?? null,
        )

        if (!keeper) {
          await db.dailyMeals.add(
            buildMeal(date, spec.role, recipe, spec.trainingSessionId),
          )
          writes += 1
          continue
        }

        const multiplier = keeper.portionMultiplier ?? 1
        const desired = buildMeal(
          date,
          spec.role,
          recipe,
          spec.trainingSessionId,
          multiplier,
        )
        desired.planningSource = keeper.planningSource ?? 'auto'

        if (!sameWeeklyPlan(keeper, desired)) {
          await db.dailyMeals.update(keeper.id, {
            ...weeklyPlanPatch(desired),
            updatedAt: now,
            version: keeper.version + 1,
          })
          writes += 1
        }

        for (const duplicate of managed.slice(1)) {
          await db.dailyMeals.update(duplicate.id, {
            deletedAt: now,
            updatedAt: now,
            version: duplicate.version + 1,
          })
          writes += 1
        }
      }

      return writes > 0
    },
  )

  if (changed) {
    publishCommittedMutation('nutrition')
  }

  return getNutritionDay(date)
}

export async function replaceDailyMealRecipe(
  mealId: string,
  recipeId: string,
) {
  const mealDate = await db.transaction(
    'rw',
    db.dailyMeals,
    db.recipes,
    async () => {
      const meal = await db.dailyMeals.get(mealId)

      if (!meal || meal.deletedAt !== null) {
        throw new Error('Comida diaria no encontrada.')
      }

      if (meal.status !== 'pending') {
        throw new Error('Solo se puede sustituir una comida pendiente.')
      }

      const recipe = await db.recipes.get(recipeId)

      if (!recipe || recipe.deletedAt !== null) {
        throw new Error('Receta no encontrada.')
      }

      if (!(recipe.compatibleRoles ?? []).includes(meal.role)) {
        throw new Error('La receta no es compatible con este momento del día.')
      }

      const multiplier = meal.portionMultiplier ?? 1
      const now = new Date().toISOString()

      await db.dailyMeals.update(meal.id, {
        recipeId: recipe.id,
        name: recipe.name,
        isImprovised: false,
        plannedQuantity: multiplier,
        plannedUnit: 'ración',
        plannedCalories: scale(recipe.estimatedCalories, multiplier),
        plannedProtein: scale(recipe.estimatedProtein, multiplier),
        plannedCarbs: scale(recipe.estimatedCarbs, multiplier),
        plannedFat: scale(recipe.estimatedFat, multiplier),
        plannedDataQuality: qualityFor(recipe),
        sourceRecipeVersion: recipe.version,
        planningSource: 'manual',
        updatedAt: now,
        version: meal.version + 1,
      })

      return meal.date
    },
  )

  publishCommittedMutation('nutrition')
  return getNutritionDay(mealDate)
}

export async function setDailyMealPortion(
  mealId: string,
  portionMultiplier: number,
) {
  if (!Number.isFinite(portionMultiplier) || portionMultiplier <= 0) {
    throw new Error('La porción debe ser mayor que cero.')
  }

  const mealDate = await db.transaction(
    'rw',
    db.dailyMeals,
    db.recipes,
    async () => {
      const meal = await db.dailyMeals.get(mealId)

      if (!meal || meal.deletedAt !== null) {
        throw new Error('Comida diaria no encontrada.')
      }

      if (meal.status !== 'pending') {
        throw new Error('Solo se puede cambiar la porción de una comida pendiente.')
      }

      const storedRecipe = meal.recipeId ? await db.recipes.get(meal.recipeId) : null
      const recipe = storedRecipe && storedRecipe.deletedAt === null ? storedRecipe : null
      const now = new Date().toISOString()

      const baseCalories = recipe?.estimatedCalories ??
        (meal.portionMultiplier ? (meal.plannedCalories ?? 0) / meal.portionMultiplier : meal.plannedCalories)
      const baseProtein = recipe?.estimatedProtein ??
        (meal.portionMultiplier ? (meal.plannedProtein ?? 0) / meal.portionMultiplier : meal.plannedProtein)
      const baseCarbs = recipe?.estimatedCarbs ??
        (meal.portionMultiplier ? (meal.plannedCarbs ?? 0) / meal.portionMultiplier : meal.plannedCarbs)
      const baseFat = recipe?.estimatedFat ??
        (meal.portionMultiplier ? (meal.plannedFat ?? 0) / meal.portionMultiplier : meal.plannedFat)

      await db.dailyMeals.update(meal.id, {
        portionMultiplier,
        plannedQuantity: portionMultiplier,
        plannedUnit: 'ración',
        plannedCalories: scale(baseCalories ?? null, portionMultiplier),
        plannedProtein: scale(baseProtein ?? null, portionMultiplier),
        plannedCarbs: scale(baseCarbs ?? null, portionMultiplier),
        plannedFat: scale(baseFat ?? null, portionMultiplier),
        updatedAt: now,
        version: meal.version + 1,
      })

      return meal.date
    },
  )

  publishCommittedMutation('nutrition')
  return getNutritionDay(mealDate)
}

export async function setDailyMealStatus(
  mealId: string,
  status: MealStatus,
) {
  const mealDate = await db.transaction('rw', db.dailyMeals, async () => {
    const meal = await db.dailyMeals.get(mealId)

    if (!meal || meal.deletedAt !== null) {
      throw new Error('Comida diaria no encontrada.')
    }

    const now = new Date().toISOString()
    const patch: Partial<DailyMeal> = {
      status,
      updatedAt: now,
      version: meal.version + 1,
    }

    if (status === 'completed') {
      patch.confirmedQuantity = meal.plannedQuantity
      patch.confirmedUnit = meal.plannedUnit
      patch.confirmedCalories = meal.plannedCalories
      patch.confirmedProtein = meal.plannedProtein
      patch.confirmedCarbs = meal.plannedCarbs
      patch.confirmedFat = meal.plannedFat
      patch.confirmedDataQuality = meal.plannedDataQuality
      patch.confirmedAt = now
      patch.skippedAt = null
    } else if (status === 'skipped') {
      patch.confirmedQuantity = null
      patch.confirmedUnit = null
      patch.confirmedCalories = null
      patch.confirmedProtein = null
      patch.confirmedCarbs = null
      patch.confirmedFat = null
      patch.confirmedDataQuality = 'unknown'
      patch.confirmedAt = null
      patch.skippedAt = now
    } else {
      patch.confirmedQuantity = null
      patch.confirmedUnit = null
      patch.confirmedCalories = null
      patch.confirmedProtein = null
      patch.confirmedCarbs = null
      patch.confirmedFat = null
      patch.confirmedDataQuality = 'unknown'
      patch.confirmedAt = null
      patch.skippedAt = null
    }

    await db.dailyMeals.update(meal.id, patch)
    return meal.date
  })

  publishCommittedMutation('nutrition')
  return getNutritionDay(mealDate)
}

export async function addImprovisedMeal(
  date: string,
  input: ImprovisedMealInput,
) {
  if (!input.submissionId.trim()) {
    throw new Error('La intención de guardado no tiene un identificador válido.')
  }

  if (!input.name.trim()) {
    throw new Error('La comida necesita un nombre.')
  }

  const values = [input.calories, input.protein, input.carbs, input.fat]
  if (values.some((value) => value !== null && (!Number.isFinite(value) || value < 0))) {
    throw new Error('Los macros deben ser números válidos o quedar vacíos.')
  }

  const quality: NutritionDataQuality = values.every((value) => value !== null)
    ? 'known'
    : values.some((value) => value !== null)
      ? 'partial'
      : 'unknown'

  const inserted = await db.transaction('rw', db.dailyMeals, async () => {
    const existing = await db.dailyMeals.get(input.submissionId)

    if (existing) {
      const sameLogicalSubmission =
        existing.deletedAt === null &&
        existing.id === input.submissionId &&
        existing.date === date &&
        existing.role === input.role &&
        existing.status === 'completed' &&
        existing.isImprovised &&
        existing.planningSource === 'manual' &&
        existing.name === input.name.trim() &&
        existing.confirmedCalories === input.calories &&
        existing.confirmedProtein === input.protein &&
        existing.confirmedCarbs === input.carbs &&
        existing.confirmedFat === input.fat

      if (!sameLogicalSubmission) {
        throw new Error(
          'Integridad Nutrition: el identificador de envío ya pertenece a otra comida.',
        )
      }

      return false
    }

    const now = new Date().toISOString()
    const meal: DailyMeal = {
      ...createBase(input.submissionId),
      createdAt: now,
      updatedAt: now,
      date,
      role: input.role,
      order: roleOrder[input.role] + 0.5,
      status: 'completed',
      trainingSessionId: null,
      recipeId: null,
      name: input.name.trim(),
      isImprovised: true,
      portionMultiplier: 1,
      plannedQuantity: 1,
      plannedUnit: 'ración',
      plannedCalories: input.calories,
      plannedProtein: input.protein,
      plannedCarbs: input.carbs,
      plannedFat: input.fat,
      plannedDataQuality: quality,
      confirmedQuantity: 1,
      confirmedUnit: 'ración',
      confirmedCalories: input.calories,
      confirmedProtein: input.protein,
      confirmedCarbs: input.carbs,
      confirmedFat: input.fat,
      confirmedDataQuality: quality,
      confirmedAt: now,
      skippedAt: null,
      notes: null,
      sourceRecipeVersion: null,
      planningSource: 'manual',
    }

    await db.dailyMeals.add(meal)
    return true
  })

  if (inserted) {
    publishCommittedMutation('nutrition')
  }

  return getNutritionDay(date)
}

function buildNutritionWeekSuggestionFromSnapshots(
  monday: string,
  recipes: readonly Recipe[],
  sessions: readonly PlannedWorkoutSession[],
  nutritionDays: readonly NutritionDay[],
  goals: readonly NutritionGoal[],
): NutritionWeekSuggestion {
  const dates = Array.from({ length: 7 }, (_, index) => shiftDateKey(monday, index))
  const activeRecipes = recipes.filter((recipe) => recipe.deletedAt === null)
  const activeSessions = activeFormalTrainingSessions(sessions)

  const days: NutritionWeekDaySuggestion[] = dates.map((date) => {
    const trainingSessions = activeSessions.filter(
      (session) => session.scheduledDate === date,
    )
    const appetiteMode =
      nutritionDays.find((day) => day.deletedAt === null && day.date === date)
        ?.appetiteMode ?? 'normal'

    const specs = desiredMealSpecsForDate(trainingSessions)
    const meals = specs.map((spec, index) => ({
      role: spec.role,
      trainingSessionId: spec.trainingSessionId,
      recipe: chooseRecipeForAppetite(
        activeRecipes,
        spec.role,
        appetiteMode,
        date,
        `week-${spec.trainingSessionId ?? 'day'}-${index}`,
      ),
      portionMultiplier: 1,
    }))

    const macroMeals = meals.map(({ role, recipe, portionMultiplier, trainingSessionId }) =>
      buildMeal(date, role, recipe, trainingSessionId, portionMultiplier),
    )

    return {
      date,
      trainingSession: trainingSessions[0] ?? null,
      trainingSessions,
      appetiteMode,
      meals,
      planned: macroSummaryFromMeals(macroMeals, 'planned'),
    }
  })

  return {
    monday,
    days,
    goal: activeGoalFrom(goals),
  }
}

function compareMealStable(a: DailyMeal, b: DailyMeal) {
  const byCreatedAt = a.createdAt.localeCompare(b.createdAt)
  if (byCreatedAt !== 0) return byCreatedAt
  return a.id.localeCompare(b.id)
}

const weeklyPlanFields = [
  'date',
  'role',
  'order',
  'trainingSessionId',
  'recipeId',
  'name',
  'isImprovised',
  'portionMultiplier',
  'plannedQuantity',
  'plannedUnit',
  'plannedCalories',
  'plannedProtein',
  'plannedCarbs',
  'plannedFat',
  'plannedDataQuality',
  'sourceRecipeVersion',
  'planningSource',
] as const satisfies readonly (keyof DailyMeal)[]

function sameWeeklyPlan(existing: DailyMeal, desired: DailyMeal) {
  return weeklyPlanFields.every((field) => existing[field] === desired[field])
}

function weeklyPlanPatch(desired: DailyMeal): Partial<DailyMeal> {
  return Object.fromEntries(
    weeklyPlanFields.map((field) => [field, desired[field]]),
  ) as Partial<DailyMeal>
}

export async function getNutritionWeekSuggestion(
  anchorDate = getLocalDateKey(),
): Promise<NutritionWeekSuggestion> {
  await reconcilePendingTrainingMeals()

  const monday = getMonday(anchorDate)
  const [recipes, sessions, nutritionDays, goals] = await Promise.all([
    db.recipes.toArray(),
    db.plannedWorkoutSessions.toArray(),
    db.nutritionDays.toArray(),
    db.nutritionGoals.toArray(),
  ])

  return buildNutritionWeekSuggestionFromSnapshots(
    monday,
    recipes,
    sessions,
    nutritionDays,
    goals,
  )
}

export async function applyNutritionWeek(anchorDate = getLocalDateKey()) {
  // The week apply owns a coherent Training snapshot and all seven day writes
  // in one transaction. Normal Day/Week reads retain B01 reconciliation.
  const monday = getMonday(anchorDate)
  const changed = await db.transaction(
    'rw',
    db.plannedWorkoutSessions,
    db.recipes,
    db.nutritionGoals,
    db.nutritionDays,
    db.dailyMeals,
    async () => {
      const [recipes, sessions, nutritionDays, goals] = await Promise.all([
        db.recipes.toArray(),
        db.plannedWorkoutSessions.toArray(),
        db.nutritionDays.toArray(),
        db.nutritionGoals.toArray(),
      ])

      const suggestion = buildNutritionWeekSuggestionFromSnapshots(
        monday,
        recipes,
        sessions,
        nutritionDays,
        goals,
      )
      const activeRecipes = recipes.filter((recipe) => recipe.deletedAt === null)
      const now = new Date().toISOString()
      let writes = 0

      for (const daySuggestion of suggestion.days) {
        const dayCandidates = (await db.nutritionDays
          .where('date')
          .equals(daySuggestion.date)
          .toArray())
          .filter((day) => day.deletedAt === null)
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))

        let day = dayCandidates[0]

        if (!day) {
          day = {
            ...createBase(),
            date: daySuggestion.date,
            appetiteMode: daySuggestion.appetiteMode,
            appliedWeeklyPlanId: null,
            notes: null,
          }
          await db.nutritionDays.add(day)
          writes += 1
        }

        const currentMeals = (await db.dailyMeals
          .where('date')
          .equals(daySuggestion.date)
          .toArray())
          .filter((meal) => meal.deletedAt === null)

        const desiredMeals = daySuggestion.meals.map((suggested) => {
          const recipe = suggested.recipe
            ? activeRecipes.find((item) => item.id === suggested.recipe?.id) ?? suggested.recipe
            : null
          const meal = buildMeal(
            daySuggestion.date,
            suggested.role,
            recipe,
            suggested.trainingSessionId,
            suggested.portionMultiplier,
          )
          meal.planningSource = 'weekly'
          return meal
        })

        const desiredKeys = new Set(
          desiredMeals.map((meal) =>
            dailyMealIdentityKey(meal.date, meal.role, meal.trainingSessionId),
          ),
        )
        const handledManagedIds = new Set<string>()

        for (const desired of desiredMeals) {
          const sameIdentity = currentMeals
            .filter((meal) =>
              dailyMealMatchesIdentity(
                meal,
                desired.date,
                desired.role,
                desired.trainingSessionId,
              ),
            )
            .sort(compareMealStable)

          const protectedFact = sameIdentity.some(
            (meal) => meal.status !== 'pending' || meal.planningSource === 'manual',
          )
          const managed = sameIdentity.filter(
            (meal) => meal.status === 'pending' && meal.planningSource !== 'manual',
          )

          if (protectedFact) {
            for (const duplicate of managed) {
              await db.dailyMeals.update(duplicate.id, {
                deletedAt: now,
                updatedAt: now,
                version: duplicate.version + 1,
              })
              handledManagedIds.add(duplicate.id)
              writes += 1
            }
            continue
          }

          const keeper = managed[0]

          if (!keeper) {
            await db.dailyMeals.add(desired)
            writes += 1
            continue
          }

          handledManagedIds.add(keeper.id)

          if (!sameWeeklyPlan(keeper, desired)) {
            await db.dailyMeals.update(keeper.id, {
              ...weeklyPlanPatch(desired),
              updatedAt: now,
              version: keeper.version + 1,
            })
            writes += 1
          }

          for (const duplicate of managed.slice(1)) {
            await db.dailyMeals.update(duplicate.id, {
              deletedAt: now,
              updatedAt: now,
              version: duplicate.version + 1,
            })
            handledManagedIds.add(duplicate.id)
            writes += 1
          }
        }

        // Generated pending structure that no longer belongs to this week's
        // desired identities is disposable. Manual and confirmed/skipped facts
        // remain untouched.
        for (const meal of currentMeals) {
          if (
            meal.status !== 'pending' ||
            meal.planningSource === 'manual' ||
            handledManagedIds.has(meal.id)
          ) {
            continue
          }

          const identity = dailyMealIdentityKey(
            meal.date,
            meal.role,
            meal.trainingSessionId,
          )

          if (!desiredKeys.has(identity)) {
            await db.dailyMeals.update(meal.id, {
              deletedAt: now,
              updatedAt: now,
              version: meal.version + 1,
            })
            writes += 1
          }
        }

        const appliedWeeklyPlanId = `week:${monday}`
        if (day.appliedWeeklyPlanId !== appliedWeeklyPlanId) {
          await db.nutritionDays.update(day.id, {
            appliedWeeklyPlanId,
            updatedAt: now,
            version: day.version + 1,
          })
          writes += 1
        }
      }

      return writes > 0
    },
  )

  if (changed) {
    publishCommittedMutation('nutrition')
  }

  return getNutritionWeekSuggestion(anchorDate)
}

export async function updateNutritionGoal(input: NutritionGoalInput) {
  const values = [
    input.targetCalories,
    input.targetProtein,
    input.targetCarbs,
    input.targetFat,
    input.targetWeightGainMinKgPerWeek,
    input.targetWeightGainMaxKgPerWeek,
  ]

  if (values.some((value) => value !== null && (!Number.isFinite(value) || value < 0))) {
    throw new Error('Los objetivos deben ser números válidos o quedar vacíos.')
  }

  if (
    input.targetWeightGainMinKgPerWeek !== null &&
    input.targetWeightGainMaxKgPerWeek !== null &&
    input.targetWeightGainMaxKgPerWeek < input.targetWeightGainMinKgPerWeek
  ) {
    throw new Error('El máximo de ganancia no puede ser menor que el mínimo.')
  }

  const now = new Date().toISOString()
  const today = getLocalDateKey()
  const newGoalId = crypto.randomUUID()

  await db.transaction('rw', db.nutritionGoals, async () => {
    const activeGoals = (await db.nutritionGoals.toArray())
      .filter((goal) => goal.deletedAt === null && goal.endsOn === null)
      .sort(
        (a, b) =>
          a.startsOn.localeCompare(b.startsOn) ||
          a.createdAt.localeCompare(b.createdAt) ||
          a.id.localeCompare(b.id),
      )

    if (activeGoals.length > 1) {
      throw new Error(
        `Integridad Nutrition: existen ${activeGoals.length} objetivos activos simultáneos.`,
      )
    }

    const active = activeGoals[0]

    if (active) {
      const updated = await db.nutritionGoals.update(active.id, {
        endsOn: today,
        updatedAt: now,
        version: active.version + 1,
      })

      if (updated !== 1) {
        throw new Error('Integridad Nutrition: no se ha podido cerrar el objetivo vigente.')
      }
    }

    await db.nutritionGoals.add({
      ...createBase(newGoalId),
      createdAt: now,
      updatedAt: now,
      startsOn: today,
      endsOn: null,
      targetCalories: input.targetCalories,
      targetProtein: input.targetProtein,
      targetCarbs: input.targetCarbs,
      targetFat: input.targetFat,
      targetWeightGainMinKgPerWeek: input.targetWeightGainMinKgPerWeek,
      targetWeightGainMaxKgPerWeek: input.targetWeightGainMaxKgPerWeek,
      notes: 'Objetivo actualizado desde Nutrition.',
    })
  })

  publishCommittedMutation('nutrition')
  return getActiveGoal()
}

export function nutritionRoleLabel(role: NutritionRole) {
  return roleLabels[role]
}
