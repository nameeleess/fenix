export function normalizeIngredientName(value: string) {
  return value
    .trim()
    .toLocaleLowerCase('es')
}

export function normalizeShoppingUnit(
  value: string | null | undefined,
) {
  const trimmed = value?.trim() ?? ''
  return trimmed || null
}
