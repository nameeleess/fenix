import type {
  DailyMeal,
  NutritionRole,
} from '../../types/nutrition'

import type {
  PlannedWorkoutSession,
} from '../../types/training'

export function isTrainingNutritionRole(role: NutritionRole) {
  return role === 'preworkout' || role === 'postworkout'
}

export function dailyMealIdentityKey(
  date: string,
  role: NutritionRole,
  trainingSessionId: string | null,
) {
  if (isTrainingNutritionRole(role)) {
    return `${date}|${role}|${trainingSessionId ?? 'none'}`
  }

  return `${date}|${role}`
}

export function dailyMealMatchesIdentity(
  meal: Pick<DailyMeal, 'date' | 'role' | 'trainingSessionId'>,
  date: string,
  role: NutritionRole,
  trainingSessionId: string | null,
) {
  return (
    dailyMealIdentityKey(
      meal.date,
      meal.role,
      meal.trainingSessionId,
    ) ===
    dailyMealIdentityKey(
      date,
      role,
      trainingSessionId,
    )
  )
}

export type PendingTrainingMealReconciliationAction =
  | {
      type: 'soft-delete'
      mealId: string
    }
  | {
      type: 'move'
      mealId: string
      targetDate: string
    }

function compareStableMealOrder(a: DailyMeal, b: DailyMeal) {
  const byCreatedAt = a.createdAt.localeCompare(b.createdAt)

  if (byCreatedAt !== 0) {
    return byCreatedAt
  }

  return a.id.localeCompare(b.id)
}

/**
 * Builds one deterministic reconciliation plan for pending Training meals.
 *
 * Identity is always the canonical target identity:
 *   date + role + trainingSessionId.
 *
 * All exact duplicates are grouped before any write is applied. This avoids
 * snapshot ping-pong where a loser soft-deleted by one iteration could later
 * act on the previously selected survivor.
 */
export function planPendingTrainingMealReconciliation(
  meals: readonly DailyMeal[],
  sessions: readonly PlannedWorkoutSession[],
): PendingTrainingMealReconciliationAction[] {
  const sessionMap = new Map(
    sessions
      .filter((session) => session.deletedAt === null)
      .map((session) => [session.id, session]),
  )

  const pendingTrainingMeals = meals
    .filter(
      (meal) =>
        meal.deletedAt === null &&
        meal.status === 'pending' &&
        Boolean(meal.trainingSessionId) &&
        isTrainingNutritionRole(meal.role),
    )
    .sort(compareStableMealOrder)

  const actions: PendingTrainingMealReconciliationAction[] = []
  const groups = new Map<
    string,
    { targetDate: string; meals: DailyMeal[] }
  >()

  for (const meal of pendingTrainingMeals) {
    const session = sessionMap.get(meal.trainingSessionId!)

    if (!session || session.status === 'omitted') {
      actions.push({
        type: 'soft-delete',
        mealId: meal.id,
      })
      continue
    }

    const targetDate = session.scheduledDate
    const identity = dailyMealIdentityKey(
      targetDate,
      meal.role,
      meal.trainingSessionId,
    )
    const group = groups.get(identity)

    if (group) {
      group.meals.push(meal)
    } else {
      groups.set(identity, {
        targetDate,
        meals: [meal],
      })
    }
  }

  for (const { targetDate, meals: identityMeals } of groups.values()) {
    const orderedMeals = [...identityMeals].sort(compareStableMealOrder)
    const survivor = orderedMeals[0]

    for (const duplicate of orderedMeals.slice(1)) {
      actions.push({
        type: 'soft-delete',
        mealId: duplicate.id,
      })
    }

    if (survivor.date !== targetDate) {
      actions.push({
        type: 'move',
        mealId: survivor.id,
        targetDate,
      })
    }
  }

  return actions
}
