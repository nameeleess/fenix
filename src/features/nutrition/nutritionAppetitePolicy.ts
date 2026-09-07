import type {
  AppetiteMode,
  NutritionRole,
  Recipe,
} from '../../types/nutrition'

function hash(value: string) {
  let total = 0
  for (let index = 0; index < value.length; index += 1) {
    total = (total * 31 + value.charCodeAt(index)) >>> 0
  }
  return total
}

function calorieValue(recipe: Recipe) {
  return recipe.estimatedCalories ?? -1
}

function appetiteFallbackPool(
  recipes: readonly Recipe[],
  appetiteMode: AppetiteMode,
) {
  if (appetiteMode === 'normal' || recipes.length <= 1) {
    return [...recipes]
  }

  const ranked = [...recipes].sort((a, b) => {
    const caloriesA = calorieValue(a)
    const caloriesB = calorieValue(b)

    if (caloriesA !== caloriesB) {
      return appetiteMode === 'compact'
        ? caloriesB - caloriesA
        : caloriesA - caloriesB
    }

    const fatA = a.estimatedFat ?? -1
    const fatB = b.estimatedFat ?? -1

    if (fatA !== fatB) {
      return appetiteMode === 'compact'
        ? fatB - fatA
        : fatA - fatB
    }

    return a.name.localeCompare(b.name, 'es')
  })

  // Schema 5 recipes predate explicit volume metadata and were migrated to
  // the neutral "normal" class. Until recipes are curated individually, use
  // the most energy-dense half as a compact fallback and the least dense half
  // as a voluminous fallback. Explicit volumeClass matches always win.
  const poolSize = recipes.length > 1
    ? Math.max(2, Math.ceil(ranked.length / 2))
    : 1
  return ranked.slice(0, Math.min(poolSize, ranked.length))
}

export function chooseRecipeForAppetite(
  recipes: readonly Recipe[],
  role: NutritionRole,
  appetiteMode: AppetiteMode,
  date: string,
  salt = '',
  currentRecipeId: string | null = null,
) {
  const roleCandidates = recipes.filter(
    (recipe) =>
      recipe.deletedAt === null &&
      (recipe.compatibleRoles ?? []).includes(role),
  )

  if (roleCandidates.length === 0) {
    return null
  }

  const explicitMatches = roleCandidates.filter(
    (recipe) => recipe.volumeClass === appetiteMode,
  )
  const explicitAlternatives = currentRecipeId === null
    ? explicitMatches
    : explicitMatches.filter((recipe) => recipe.id !== currentRecipeId)

  let appetitePool: Recipe[]

  if (explicitAlternatives.length > 0) {
    appetitePool = explicitAlternatives
  } else {
    const fallback = appetiteFallbackPool(roleCandidates, appetiteMode)
    const fallbackAlternatives = currentRecipeId === null
      ? fallback
      : fallback.filter((recipe) => recipe.id !== currentRecipeId)

    if (fallbackAlternatives.length > 0) {
      appetitePool = fallbackAlternatives
    } else if (explicitMatches.length > 0) {
      appetitePool = explicitMatches
    } else {
      appetitePool = fallback
    }
  }

  const favorites = appetitePool.filter((recipe) => recipe.isFavorite)
  const pool = favorites.length > 0 ? favorites : appetitePool
  const sorted = [...pool].sort(
    (a, b) => a.name.localeCompare(b.name, 'es') || a.id.localeCompare(b.id),
  )

  return sorted[
    hash(`${date}:${role}:${appetiteMode}:${salt}:${currentRecipeId ?? 'none'}`) % sorted.length
  ] ?? null
}
