import { db } from '../../db/database'

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
  trainingSession: PlannedWorkoutSession | null
  meals: NutritionMealView[]
  goal: NutritionGoal | null
  planned: MacroSummary
  consumed: MacroSummary
}

export interface NutritionWeekDaySuggestion {
  date: string
  trainingSession: PlannedWorkoutSession | null
  appetiteMode: AppetiteMode
  meals: Array<{
    role: NutritionRole
    recipe: Recipe | null
    portionMultiplier: number
  }>
  planned: MacroSummary
}

export interface NutritionWeekSuggestion {
  monday: string
  days: NutritionWeekDaySuggestion[]
  goal: NutritionGoal | null
}

export interface ImprovisedMealInput {
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

function hash(value: string) {
  let total = 0
  for (let index = 0; index < value.length; index += 1) {
    total = (total * 31 + value.charCodeAt(index)) >>> 0
  }
  return total
}

function rolesFor(trainingSession: PlannedWorkoutSession | null) {
  if (trainingSession) {
    return [
      'preworkout',
      'postworkout',
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

function chooseRecipe(
  recipes: Recipe[],
  role: NutritionRole,
  appetiteMode: AppetiteMode,
  date: string,
  salt = '',
) {
  const roleCandidates = recipes.filter(
    (recipe) =>
      recipe.deletedAt === null &&
      (recipe.compatibleRoles ?? []).includes(role),
  )

  if (roleCandidates.length === 0) {
    return null
  }

  const volumeCandidates = roleCandidates.filter(
    (recipe) => recipe.volumeClass === appetiteMode,
  )

  const volumePool =
    volumeCandidates.length > 0 ? volumeCandidates : roleCandidates

  const favorites = volumePool.filter((recipe) => recipe.isFavorite)
  const pool = favorites.length > 0 ? favorites : volumePool
  const sorted = [...pool].sort((a, b) => a.name.localeCompare(b.name, 'es'))

  return sorted[hash(`${date}:${role}:${salt}`) % sorted.length] ?? null
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

async function getActiveGoal() {
  const goals = (await db.nutritionGoals.toArray())
    .filter((goal) => goal.deletedAt === null && goal.endsOn === null)
    .sort((a, b) => b.startsOn.localeCompare(a.startsOn))

  return goals[0] ?? null
}

async function getTrainingSessionForDate(date: string) {
  const sessions = (await db.plannedWorkoutSessions
    .where('scheduledDate')
    .equals(date)
    .toArray())
    .filter(
      (session) =>
        session.deletedAt === null &&
        session.isFormalStrength &&
        !session.isExtra &&
        session.status !== 'omitted',
    )
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))

  return sessions[0] ?? null
}

async function reconcilePendingTrainingMeals() {
  const [sessions, meals] = await Promise.all([
    db.plannedWorkoutSessions.toArray(),
    db.dailyMeals.toArray(),
  ])

  const sessionMap = new Map(
    sessions
      .filter((session) => session.deletedAt === null)
      .map((session) => [session.id, session]),
  )

  const activeMeals = meals.filter((meal) => meal.deletedAt === null)
  const now = new Date().toISOString()

  for (const meal of activeMeals) {
    if (
      meal.status !== 'pending' ||
      !meal.trainingSessionId ||
      (meal.role !== 'preworkout' && meal.role !== 'postworkout')
    ) {
      continue
    }

    const session = sessionMap.get(meal.trainingSessionId)

    if (!session || session.status === 'omitted') {
      await db.dailyMeals.update(meal.id, {
        deletedAt: now,
        updatedAt: now,
        version: meal.version + 1,
      })
      continue
    }

    if (meal.date === session.scheduledDate) {
      continue
    }

    const duplicate = activeMeals.find(
      (candidate) =>
        candidate.id !== meal.id &&
        candidate.date === session.scheduledDate &&
        candidate.role === meal.role &&
        candidate.status === 'pending',
    )

    if (duplicate) {
      await db.dailyMeals.update(duplicate.id, {
        deletedAt: now,
        updatedAt: now,
        version: duplicate.version + 1,
      })
    }

    await db.dailyMeals.update(meal.id, {
      date: session.scheduledDate,
      updatedAt: now,
      version: meal.version + 1,
    })
  }
}

async function ensureNutritionDayEntity(date: string) {
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
}

async function ensureDayStructure(
  date: string,
  day: NutritionDay,
  recipes: Recipe[],
  trainingSession: PlannedWorkoutSession | null,
) {
  const expectedRoles = rolesFor(trainingSession)
  const meals = (await db.dailyMeals.where('date').equals(date).toArray()).filter(
    (meal) => meal.deletedAt === null,
  )
  const now = new Date().toISOString()

  for (const meal of meals) {
    if (meal.status !== 'pending') {
      continue
    }

    const isObsoleteTrainingRole =
      !trainingSession &&
      (meal.role === 'preworkout' || meal.role === 'postworkout')

    const isObsoleteBreakfast = Boolean(trainingSession) && meal.role === 'breakfast'

    if (isObsoleteTrainingRole || isObsoleteBreakfast) {
      await db.dailyMeals.update(meal.id, {
        deletedAt: now,
        updatedAt: now,
        version: meal.version + 1,
      })
    }
  }

  const refreshed = (await db.dailyMeals.where('date').equals(date).toArray()).filter(
    (meal) => meal.deletedAt === null,
  )

  for (const role of expectedRoles) {
    const exists = refreshed.some((meal) => meal.role === role)
    if (exists) {
      continue
    }

    const recipe = chooseRecipe(recipes, role, day.appetiteMode, date)
    await db.dailyMeals.add(
      buildMeal(date, role, recipe, trainingSession?.id ?? null),
    )
  }
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

export async function getNutritionDay(
  date = getLocalDateKey(),
): Promise<NutritionDayView> {
  await reconcilePendingTrainingMeals()

  const [day, recipes, trainingSession, goal] = await Promise.all([
    ensureNutritionDayEntity(date),
    db.recipes.toArray(),
    getTrainingSessionForDate(date),
    getActiveGoal(),
  ])

  await ensureDayStructure(
    date,
    day,
    recipes.filter((recipe) => recipe.deletedAt === null),
    trainingSession,
  )

  const meals = await buildMealViews(date, day.appetiteMode)
  const rawMeals = meals.map((item) => item.meal)

  return {
    date,
    day,
    trainingSession,
    meals,
    goal,
    planned: macroSummaryFromMeals(rawMeals, 'planned'),
    consumed: macroSummaryFromMeals(rawMeals, 'confirmed'),
  }
}

export function getRelevantNutritionMeal(
  day: NutritionDayView,
): NutritionMealView | null {
  const pending = day.meals.filter((item) => item.meal.status === 'pending')

  if (pending.length === 0) {
    return null
  }

  if (day.trainingSession) {
    const trainingStatus = day.trainingSession.status

    if (trainingStatus === 'pending') {
      const preworkout = pending.find((item) => item.meal.role === 'preworkout')
      if (preworkout) {
        return preworkout
      }

      const postworkout = pending.find((item) => item.meal.role === 'postworkout')
      if (postworkout) {
        return postworkout
      }
    }

    if (
      trainingStatus === 'in_progress' ||
      trainingStatus === 'completed' ||
      trainingStatus === 'incomplete'
    ) {
      const postworkout = pending.find((item) => item.meal.role === 'postworkout')
      if (postworkout) {
        return postworkout
      }
    }
  }

  const sequence: NutritionRole[] = [
    'breakfast',
    'main_meal',
    'snack',
    'dinner',
    'extra',
    'preworkout',
    'postworkout',
  ]

  for (const role of sequence) {
    const meal = pending.find((item) => item.meal.role === role)
    if (meal) {
      return meal
    }
  }

  return pending[0] ?? null
}

export async function setNutritionDayAppetite(
  date: string,
  appetiteMode: AppetiteMode,
) {
  const day = await ensureNutritionDayEntity(date)

  await db.nutritionDays.update(day.id, {
    appetiteMode,
    updatedAt: new Date().toISOString(),
    version: day.version + 1,
  })

  return getNutritionDay(date)
}

export async function replaceDailyMealRecipe(
  mealId: string,
  recipeId: string,
) {
  const [meal, recipe] = await Promise.all([
    db.dailyMeals.get(mealId),
    db.recipes.get(recipeId),
  ])

  if (!meal || meal.deletedAt !== null) {
    throw new Error('Comida diaria no encontrada.')
  }

  if (meal.status !== 'pending') {
    throw new Error('Solo se puede sustituir una comida pendiente.')
  }

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
    planningSource: meal.planningSource ?? 'manual',
    updatedAt: now,
    version: meal.version + 1,
  })

  return getNutritionDay(meal.date)
}

export async function setDailyMealPortion(
  mealId: string,
  portionMultiplier: number,
) {
  if (!Number.isFinite(portionMultiplier) || portionMultiplier <= 0) {
    throw new Error('La porción debe ser mayor que cero.')
  }

  const meal = await db.dailyMeals.get(mealId)

  if (!meal || meal.deletedAt !== null) {
    throw new Error('Comida diaria no encontrada.')
  }

  if (meal.status !== 'pending') {
    throw new Error('Solo se puede cambiar la porción de una comida pendiente.')
  }

  const recipe = meal.recipeId ? await db.recipes.get(meal.recipeId) : null
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

  return getNutritionDay(meal.date)
}

export async function setDailyMealStatus(
  mealId: string,
  status: MealStatus,
) {
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
  return getNutritionDay(meal.date)
}

export async function addImprovisedMeal(
  date: string,
  input: ImprovisedMealInput,
) {
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

  const meal: DailyMeal = {
    ...createBase(),
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
    confirmedAt: new Date().toISOString(),
    skippedAt: null,
    notes: null,
    sourceRecipeVersion: null,
    planningSource: 'manual',
  }

  await db.dailyMeals.add(meal)
  return getNutritionDay(date)
}

export async function getNutritionWeekSuggestion(
  anchorDate = getLocalDateKey(),
): Promise<NutritionWeekSuggestion> {
  await reconcilePendingTrainingMeals()

  const monday = getMonday(anchorDate)
  const dates = Array.from({ length: 7 }, (_, index) => shiftDateKey(monday, index))
  const [recipes, sessions, nutritionDays, goal] = await Promise.all([
    db.recipes.toArray(),
    db.plannedWorkoutSessions.toArray(),
    db.nutritionDays.toArray(),
    getActiveGoal(),
  ])

  const activeRecipes = recipes.filter((recipe) => recipe.deletedAt === null)
  const activeSessions = sessions.filter(
    (session) =>
      session.deletedAt === null &&
      session.isFormalStrength &&
      !session.isExtra &&
      session.status !== 'omitted',
  )

  const days: NutritionWeekDaySuggestion[] = dates.map((date) => {
    const trainingSession =
      activeSessions.find((session) => session.scheduledDate === date) ?? null
    const appetiteMode =
      nutritionDays.find((day) => day.deletedAt === null && day.date === date)
        ?.appetiteMode ?? 'normal'

    const meals = rolesFor(trainingSession).map((role, index) => ({
      role,
      recipe: chooseRecipe(activeRecipes, role, appetiteMode, date, `week-${index}`),
      portionMultiplier: 1,
    }))

    const macroMeals = meals.map(({ role, recipe, portionMultiplier }) =>
      buildMeal(date, role, recipe, trainingSession?.id ?? null, portionMultiplier),
    )

    return {
      date,
      trainingSession,
      appetiteMode,
      meals,
      planned: macroSummaryFromMeals(macroMeals, 'planned'),
    }
  })

  return { monday, days, goal }
}

export async function applyNutritionWeek(anchorDate = getLocalDateKey()) {
  const suggestion = await getNutritionWeekSuggestion(anchorDate)
  const recipes = (await db.recipes.toArray()).filter((recipe) => recipe.deletedAt === null)
  const now = new Date().toISOString()

  for (const daySuggestion of suggestion.days) {
    const day = await ensureNutritionDayEntity(daySuggestion.date)
    const currentMeals = (await db.dailyMeals
      .where('date')
      .equals(daySuggestion.date)
      .toArray())
      .filter((meal) => meal.deletedAt === null)

    for (const meal of currentMeals) {
      if (meal.status === 'pending') {
        await db.dailyMeals.update(meal.id, {
          deletedAt: now,
          updatedAt: now,
          version: meal.version + 1,
        })
      }
    }

    for (const suggested of daySuggestion.meals) {
      const recipe = suggested.recipe
        ? recipes.find((item) => item.id === suggested.recipe?.id) ?? suggested.recipe
        : null
      const meal = buildMeal(
        daySuggestion.date,
        suggested.role,
        recipe,
        daySuggestion.trainingSession?.id ?? null,
        suggested.portionMultiplier,
      )
      meal.planningSource = 'weekly'
      await db.dailyMeals.add(meal)
    }

    await db.nutritionDays.update(day.id, {
      appliedWeeklyPlanId: `week:${suggestion.monday}`,
      updatedAt: now,
      version: day.version + 1,
    })
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

  const active = await getActiveGoal()
  const now = new Date().toISOString()
  const today = getLocalDateKey()

  await db.transaction('rw', db.nutritionGoals, async () => {
    if (active) {
      await db.nutritionGoals.update(active.id, {
        endsOn: today,
        updatedAt: now,
        version: active.version + 1,
      })
    }

    await db.nutritionGoals.add({
      ...createBase(),
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

  return getActiveGoal()
}

export function nutritionRoleLabel(role: NutritionRole) {
  return roleLabels[role]
}
