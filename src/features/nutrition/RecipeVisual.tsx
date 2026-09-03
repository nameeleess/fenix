import type { NutritionRole, Recipe } from '../../types/nutrition'

function fallbackClass(role?: NutritionRole | null) {
  if (role === 'preworkout') return 'is-pre'
  if (role === 'postworkout') return 'is-post'
  if (role === 'dinner') return 'is-dinner'
  if (role === 'snack') return 'is-snack'
  return 'is-main'
}

export default function RecipeVisual({
  recipe,
  role = null,
  name,
  variant = 'thumb',
}: {
  recipe: Recipe | null
  role?: NutritionRole | null
  name?: string | null
  variant?: 'thumb' | 'hero' | 'card'
}) {
  const label = recipe?.name ?? name ?? 'Comida'
  const imageSrc = recipe ? `/media/recipes/${recipe.id}.webp` : null

  return (
    <span
      className={`recipe-visual recipe-visual--${variant} ${fallbackClass(role)}`}
      aria-label={`Imagen de ${label}`}
      role="img"
    >
      {imageSrc ? (
        <img
          src={imageSrc}
          alt=""
          loading={variant === 'hero' ? 'eager' : 'lazy'}
          decoding="async"
          onError={(event) => {
            event.currentTarget.style.display = 'none'
          }}
        />
      ) : null}
      <span className="recipe-visual__fallback" aria-hidden="true">
        <svg viewBox="0 0 64 64" focusable="false">
          <ellipse cx="32" cy="39" rx="23" ry="14" />
          <path d="M17 37c5-7 10-10 15-10s10 3 15 10" />
          <path d="M24 20c-3-5 4-7 1-12M37 20c-3-5 4-7 1-12" />
        </svg>
      </span>
    </span>
  )
}
