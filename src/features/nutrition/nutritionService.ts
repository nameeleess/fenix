import { db } from '../../db/database'
import { publishCommittedMutation } from '../../app/freshnessEvents'
import {
  normalizeIngredientName as normalizeName,
  normalizeShoppingUnit as normalizeUnit,
} from './nutritionLibraryIdentity.ts'

import type {
  Ingredient,
  IngredientCategory,
  NutritionCategory,
  PreparationState,
  Recipe,
  RecipeIngredient,
  ShoppingItem,
} from '../../types/nutrition'

export interface RecipeIngredientView {
  relation: RecipeIngredient
  ingredient: Ingredient
}

export interface RecipeView {
  recipe: Recipe
  ingredients: RecipeIngredientView[]
}

export interface ShoppingItemView {
  item: ShoppingItem
  ingredient: Ingredient
}

export interface RecipeIngredientInput {
  name: string
  category: IngredientCategory
  quantity: number | null
  quantityMax: number | null
  unit: string | null
  preparationState: PreparationState | null
  notes: string | null
}

export interface RecipeInput {
  name: string
  category: NutritionCategory
  estimatedCalories: number | null
  estimatedProtein: number | null
  estimatedCarbs: number | null
  estimatedFat: number | null
  instructions: string | null
  notes: string | null
  ingredients: RecipeIngredientInput[]
}

export interface CatalogIngredientInput {
  name: string
  category: IngredientCategory
  defaultUnit: string | null
  notes: string | null
}

export interface ShoppingItemInput {
  quantity: number | null
  quantityMax: number | null
  unit: string | null
}

function createBase() {
  const now = new Date().toISOString()

  return {
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    version: 1,
  }
}

function validateQuantityRange(
  quantity: number | null,
  quantityMax: number | null,
) {
  if (
    quantity !== null &&
    quantity < 0
  ) {
    throw new Error(
      'La cantidad no puede ser negativa.',
    )
  }

  if (
    quantityMax !== null &&
    quantityMax < 0
  ) {
    throw new Error(
      'La cantidad máxima no puede ser negativa.',
    )
  }

  if (
    quantity !== null &&
    quantityMax !== null &&
    quantityMax < quantity
  ) {
    throw new Error(
      'La cantidad máxima no puede ser menor que la mínima.',
    )
  }
}

function validateRecipeInput(
  input: RecipeInput,
) {
  if (!input.name.trim()) {
    throw new Error(
      'La receta necesita un nombre.',
    )
  }

  if (input.ingredients.length === 0) {
    throw new Error(
      'Añade al menos un ingrediente.',
    )
  }

  for (const ingredient of input.ingredients) {
    if (!ingredient.name.trim()) {
      throw new Error(
        'Todos los ingredientes necesitan un nombre.',
      )
    }

    validateQuantityRange(
      ingredient.quantity,
      ingredient.quantityMax,
    )
  }
}

async function findActiveIngredientByName(
  name: string,
) {
  const ingredients =
    await db.ingredients.toArray()

  const normalized =
    normalizeName(name)

  return ingredients.find(
    (ingredient) =>
      ingredient.deletedAt === null &&
      normalizeName(
        ingredient.name,
      ) === normalized,
  )
}

async function findOrCreateIngredient(
  input: RecipeIngredientInput,
): Promise<Ingredient> {
  const existing =
    await findActiveIngredientByName(
      input.name,
    )

  if (existing) {
    return existing
  }

  const base = createBase()

  const ingredient: Ingredient = {
    ...base,
    name: input.name.trim(),
    category: input.category,
    defaultUnit:
      input.unit?.trim() || null,
    notes: null,
  }

  await db.ingredients.add(
    ingredient,
  )

  return ingredient
}

async function createRecipeRelations(
  recipeId: string,
  ingredients: RecipeIngredientInput[],
) {
  const relations:
    RecipeIngredient[] = []

  for (
    let index = 0;
    index < ingredients.length;
    index += 1
  ) {
    const input =
      ingredients[index]

    const ingredient =
      await findOrCreateIngredient(
        input,
      )

    relations.push({
      ...createBase(),
      recipeId,
      ingredientId:
        ingredient.id,
      order: index + 1,
      quantity:
        input.quantity,
      quantityMax:
        input.quantityMax,
      unit:
        input.unit?.trim() ||
        null,
      preparationState:
        input.preparationState,
      notes:
        input.notes?.trim() ||
        null,
    })
  }

  await db.recipeIngredients.bulkAdd(
    relations,
  )
}

async function archiveRecipeRelations(
  recipeId: string,
) {
  const relations =
    await db.recipeIngredients
      .where('recipeId')
      .equals(recipeId)
      .toArray()

  const now =
    new Date().toISOString()

  for (const relation of relations) {
    if (
      relation.deletedAt !== null
    ) {
      continue
    }

    await db.recipeIngredients.update(
      relation.id,
      {
        deletedAt: now,
        updatedAt: now,
        version:
          relation.version + 1,
      },
    )
  }
}

export async function getNutritionRecipes(): Promise<
  RecipeView[]
> {
  const recipes =
    await db.recipes.toArray()

  const activeRecipes =
    recipes
      .filter(
        (recipe) =>
          recipe.deletedAt === null,
      )
      .sort(
        (a, b) =>
          a.name.localeCompare(
            b.name,
            'es',
          ),
      )

  const result:
    RecipeView[] = []

  for (const recipe of activeRecipes) {
    const relations =
      await db.recipeIngredients
        .where('recipeId')
        .equals(recipe.id)
        .toArray()

    relations.sort(
      (a, b) =>
        a.order - b.order,
    )

    const ingredients:
      RecipeIngredientView[] = []

    for (const relation of relations) {
      if (
        relation.deletedAt !== null
      ) {
        continue
      }

      const ingredient =
        await db.ingredients.get(
          relation.ingredientId,
        )

      if (
        !ingredient ||
        ingredient.deletedAt !== null
      ) {
        continue
      }

      ingredients.push({
        relation,
        ingredient,
      })
    }

    result.push({
      recipe,
      ingredients,
    })
  }

  return result
}

export async function createRecipe(
  input: RecipeInput,
): Promise<Recipe> {
  validateRecipeInput(input)

  const recipe: Recipe = {
    ...createBase(),
    name: input.name.trim(),
    category: input.category,
    instructions:
      input.instructions?.trim() ||
      null,
    estimatedCalories:
      input.estimatedCalories,
    estimatedProtein:
      input.estimatedProtein,
    estimatedCarbs:
      input.estimatedCarbs,
    estimatedFat:
      input.estimatedFat,
    isFavorite: false,
    notes:
      input.notes?.trim() ||
      null,
  }

  await db.transaction(
    'rw',
    db.recipes,
    db.ingredients,
    db.recipeIngredients,
    async () => {
      await db.recipes.add(
        recipe,
      )

      await createRecipeRelations(
        recipe.id,
        input.ingredients,
      )
    },
  )

  publishCommittedMutation('nutrition')
  return recipe
}

export async function updateRecipe(
  recipeId: string,
  input: RecipeInput,
): Promise<Recipe> {
  validateRecipeInput(input)

  const updated = await db.transaction(
    'rw',
    db.recipes,
    db.ingredients,
    db.recipeIngredients,
    async () => {
      const existing = await db.recipes.get(recipeId)

      if (!existing || existing.deletedAt !== null) {
        throw new Error('No se ha encontrado la receta.')
      }

      const next: Recipe = {
        ...existing,
        name: input.name.trim(),
        category: input.category,
        instructions: input.instructions?.trim() || null,
        estimatedCalories: input.estimatedCalories,
        estimatedProtein: input.estimatedProtein,
        estimatedCarbs: input.estimatedCarbs,
        estimatedFat: input.estimatedFat,
        notes: input.notes?.trim() || null,
        updatedAt: new Date().toISOString(),
        version: existing.version + 1,
      }

      await db.recipes.put(next)
      await archiveRecipeRelations(recipeId)
      await createRecipeRelations(recipeId, input.ingredients)
      return next
    },
  )

  publishCommittedMutation('nutrition')
  return updated
}

export async function duplicateRecipe(
  recipeId: string,
) {
  const recipes =
    await getNutritionRecipes()

  const source =
    recipes.find(
      (item) =>
        item.recipe.id ===
        recipeId,
    )

  if (!source) {
    throw new Error(
      'No se ha encontrado la receta.',
    )
  }

  return createRecipe({
    name:
      `${source.recipe.name} (copia)`,
    category:
      source.recipe.category,
    estimatedCalories:
      source.recipe
        .estimatedCalories,
    estimatedProtein:
      source.recipe
        .estimatedProtein,
    estimatedCarbs:
      source.recipe
        .estimatedCarbs,
    estimatedFat:
      source.recipe
        .estimatedFat,
    instructions:
      source.recipe.instructions,
    notes:
      source.recipe.notes,
    ingredients:
      source.ingredients.map(
        ({
          relation,
          ingredient,
        }) => ({
          name:
            ingredient.name,
          category:
            ingredient.category,
          quantity:
            relation.quantity,
          quantityMax:
            relation.quantityMax,
          unit:
            relation.unit,
          preparationState:
            relation.preparationState,
          notes:
            relation.notes,
        }),
      ),
  })
}

export async function deleteRecipe(
  recipeId: string,
) {
  const changed = await db.transaction(
    'rw',
    db.recipes,
    db.recipeIngredients,
    async () => {
      const recipe = await db.recipes.get(recipeId)

      if (!recipe || recipe.deletedAt !== null) {
        return false
      }

      const now = new Date().toISOString()
      const updated = await db.recipes.update(recipeId, {
        deletedAt: now,
        updatedAt: now,
        version: recipe.version + 1,
      })

      if (updated !== 1) {
        throw new Error('No se ha podido eliminar la receta.')
      }

      await archiveRecipeRelations(recipeId)
      return true
    },
  )

  if (changed) {
    publishCommittedMutation('nutrition')
  }
}

export async function toggleRecipeFavorite(
  recipeId: string,
): Promise<Recipe> {
  const updated = await db.transaction('rw', db.recipes, async () => {
    const recipe = await db.recipes.get(recipeId)

    if (!recipe || recipe.deletedAt !== null) {
      throw new Error('No se ha encontrado la receta.')
    }

    const next: Recipe = {
      ...recipe,
      isFavorite: !recipe.isFavorite,
      updatedAt: new Date().toISOString(),
      version: recipe.version + 1,
    }

    await db.recipes.put(next)
    return next
  })

  publishCommittedMutation('nutrition')
  return updated
}

export async function getIngredientCatalog(): Promise<
  Ingredient[]
> {
  const ingredients =
    await db.ingredients.toArray()

  return ingredients
    .filter(
      (ingredient) =>
        ingredient.deletedAt === null,
    )
    .sort(
      (a, b) =>
        a.name.localeCompare(
          b.name,
          'es',
        ),
    )
}

export async function createCatalogIngredient(
  input: CatalogIngredientInput,
): Promise<Ingredient> {
  if (!input.name.trim()) {
    throw new Error(
      'El producto necesita un nombre.',
    )
  }

  const ingredient = await db.transaction(
    'rw',
    db.ingredients,
    async () => {
      const duplicate =
        await findActiveIngredientByName(
          input.name,
        )

      if (duplicate) {
        throw new Error(
          'Ya existe un producto con ese nombre.',
        )
      }

      const created: Ingredient = {
        ...createBase(),
        name: input.name.trim(),
        category: input.category,
        defaultUnit:
          normalizeUnit(input.defaultUnit),
        notes:
          input.notes?.trim() ||
          null,
      }

      await db.ingredients.add(created)
      return created
    },
  )

  publishCommittedMutation('nutrition')
  return ingredient
}

export async function updateCatalogIngredient(
  ingredientId: string,
  input: CatalogIngredientInput,
): Promise<Ingredient> {
  if (!input.name.trim()) {
    throw new Error(
      'El producto necesita un nombre.',
    )
  }

  const updated = await db.transaction(
    'rw',
    db.ingredients,
    async () => {
      const existing =
        await db.ingredients.get(ingredientId)

      if (!existing || existing.deletedAt !== null) {
        throw new Error(
          'No se ha encontrado el producto.',
        )
      }

      const ingredients =
        await db.ingredients.toArray()

      const normalized =
        normalizeName(input.name)

      const duplicate = ingredients.find(
        (ingredient) =>
          ingredient.id !== ingredientId &&
          ingredient.deletedAt === null &&
          normalizeName(ingredient.name) === normalized,
      )

      if (duplicate) {
        throw new Error(
          'Ya existe otro producto con ese nombre.',
        )
      }

      const next: Ingredient = {
        ...existing,
        name: input.name.trim(),
        category: input.category,
        defaultUnit:
          normalizeUnit(input.defaultUnit),
        notes:
          input.notes?.trim() || null,
        updatedAt: new Date().toISOString(),
        version: existing.version + 1,
      }

      await db.ingredients.put(next)
      return next
    },
  )

  publishCommittedMutation('nutrition')
  return updated
}

export async function deleteCatalogIngredient(
  ingredientId: string,
) {
  const changed = await db.transaction(
    'rw',
    db.ingredients,
    db.recipeIngredients,
    db.recipes,
    db.shoppingItems,
    async () => {
      const ingredient =
        await db.ingredients.get(ingredientId)

      if (!ingredient || ingredient.deletedAt !== null) {
        return false
      }

      const relations =
        await db.recipeIngredients
          .where('ingredientId')
          .equals(ingredientId)
          .toArray()

      const activeRelations = relations.filter(
        (relation) => relation.deletedAt === null,
      )

      const activeRecipeIds = new Set<string>()

      for (const relation of activeRelations) {
        const recipe = await db.recipes.get(relation.recipeId)
        if (recipe && recipe.deletedAt === null) {
          activeRecipeIds.add(recipe.id)
        }
      }

      if (activeRecipeIds.size > 0) {
        throw new Error(
          activeRecipeIds.size === 1
            ? 'Este producto está siendo utilizado por una receta. Elimínalo o sustitúyelo primero en esa receta.'
            : `Este producto está siendo utilizado por ${activeRecipeIds.size} recetas. Elimínalo o sustitúyelo primero en esas recetas.`,
        )
      }

      const shoppingItems =
        await db.shoppingItems
          .where('ingredientId')
          .equals(ingredientId)
          .toArray()

      const now = new Date().toISOString()

      await db.ingredients.put({
        ...ingredient,
        deletedAt: now,
        updatedAt: now,
        version: ingredient.version + 1,
      })

      for (const item of shoppingItems) {
        if (item.deletedAt !== null) continue

        await db.shoppingItems.put({
          ...item,
          deletedAt: now,
          updatedAt: now,
          version: item.version + 1,
        })
      }

      return true
    },
  )

  if (changed) {
    publishCommittedMutation('nutrition')
  }
}

function combineQuantities(
  currentQuantity: number | null,
  currentQuantityMax: number | null,
  addedQuantity: number | null,
  addedQuantityMax: number | null,
) {
  if (
    addedQuantity === null &&
    addedQuantityMax === null
  ) {
    return {
      quantity:
        currentQuantity,
      quantityMax:
        currentQuantityMax,
    }
  }

  if (
    currentQuantity === null &&
    currentQuantityMax === null
  ) {
    return {
      quantity:
        addedQuantity,
      quantityMax:
        addedQuantityMax,
    }
  }

  const currentMinimum =
    currentQuantity ?? 0

  const addedMinimum =
    addedQuantity ?? 0

  const minimum =
    currentMinimum +
    addedMinimum

  const currentMaximum =
    currentQuantityMax ??
    currentQuantity ??
    0

  const addedMaximum =
    addedQuantityMax ??
    addedQuantity ??
    0

  const maximum =
    currentMaximum +
    addedMaximum

  return {
    quantity: minimum,
    quantityMax:
      maximum > minimum
        ? maximum
        : null,
  }
}

async function addIngredientToBasketInTransaction(
  ingredientId: string,
  quantity: number | null,
  quantityMax: number | null,
  unit: string | null,
) {
  const ingredient =
    await db.ingredients.get(ingredientId)

  if (!ingredient || ingredient.deletedAt !== null) {
    throw new Error(
      'No se ha encontrado el producto.',
    )
  }

  const normalizedUnit = normalizeUnit(unit)

  const items =
    await db.shoppingItems
      .where('ingredientId')
      .equals(ingredientId)
      .toArray()

  const existing = items.find(
    (item) =>
      item.deletedAt === null &&
      normalizeUnit(item.unit) === normalizedUnit,
  )

  const now = new Date().toISOString()

  if (existing) {
    const combined = combineQuantities(
      existing.quantity,
      existing.quantityMax,
      quantity,
      quantityMax,
    )

    const next: ShoppingItem = {
      ...existing,
      quantity: combined.quantity,
      quantityMax: combined.quantityMax,
      unit: normalizedUnit,
      checked: false,
      updatedAt: now,
      version: existing.version + 1,
    }

    await db.shoppingItems.put(next)
    return next
  }

  const item: ShoppingItem = {
    ...createBase(),
    ingredientId,
    quantity,
    quantityMax,
    unit: normalizedUnit,
    checked: false,
    addedAt: now,
  }

  await db.shoppingItems.add(item)
  return item
}

export async function addRecipeIngredientToBasket(
  relationId: string,
) {
  const result = await db.transaction(
    'rw',
    db.recipes,
    db.recipeIngredients,
    db.ingredients,
    db.shoppingItems,
    async () => {
      const relation =
        await db.recipeIngredients.get(relationId)

      if (!relation || relation.deletedAt !== null) {
        throw new Error(
          'No se ha encontrado el ingrediente de la receta.',
        )
      }

      const recipe = await db.recipes.get(relation.recipeId)
      if (!recipe || recipe.deletedAt !== null) {
        throw new Error(
          'La receta asociada ya no está disponible.',
        )
      }

      return addIngredientToBasketInTransaction(
        relation.ingredientId,
        relation.quantity,
        relation.quantityMax,
        relation.unit,
      )
    },
  )

  publishCommittedMutation('nutrition')
  return result
}

export async function addCatalogIngredientToBasket(
  ingredientId: string,
) {
  const result = await db.transaction(
    'rw',
    db.ingredients,
    db.shoppingItems,
    async () => {
      const ingredient =
        await db.ingredients.get(ingredientId)

      if (!ingredient || ingredient.deletedAt !== null) {
        throw new Error(
          'No se ha encontrado el producto.',
        )
      }

      return addIngredientToBasketInTransaction(
        ingredientId,
        null,
        null,
        ingredient.defaultUnit,
      )
    },
  )

  publishCommittedMutation('nutrition')
  return result
}

export async function getShoppingList(): Promise<
  ShoppingItemView[]
> {
  const items =
    await db.shoppingItems.toArray()

  const activeItems =
    items
      .filter(
        (item) =>
          item.deletedAt === null,
      )
      .sort(
        (a, b) => {
          if (
            a.checked !== b.checked
          ) {
            return (
              Number(a.checked) -
              Number(b.checked)
            )
          }

          return (
            Date.parse(
              b.addedAt,
            ) -
            Date.parse(
              a.addedAt,
            )
          )
        },
      )

  const result:
    ShoppingItemView[] = []

  for (const item of activeItems) {
    const ingredient =
      await db.ingredients.get(
        item.ingredientId,
      )

    if (
      !ingredient ||
      ingredient.deletedAt !== null
    ) {
      continue
    }

    result.push({
      item,
      ingredient,
    })
  }

  return result
}

export async function updateShoppingItem(
  itemId: string,
  input: ShoppingItemInput,
) {
  validateQuantityRange(
    input.quantity,
    input.quantityMax,
  )

  await db.transaction(
    'rw',
    db.ingredients,
    db.shoppingItems,
    async () => {
      const item = await db.shoppingItems.get(itemId)

      if (!item || item.deletedAt !== null) {
        throw new Error(
          'No se ha encontrado el producto de la cesta.',
        )
      }

      const ingredient = await db.ingredients.get(item.ingredientId)
      if (!ingredient || ingredient.deletedAt !== null) {
        throw new Error('El producto asociado ya no está disponible.')
      }

      const unit = normalizeUnit(input.unit)
      const siblings = await db.shoppingItems
        .where('ingredientId')
        .equals(item.ingredientId)
        .toArray()

      const duplicate = siblings.find(
        (candidate) =>
          candidate.id !== item.id &&
          candidate.deletedAt === null &&
          normalizeUnit(candidate.unit) === unit,
      )

      if (duplicate) {
        throw new Error(
          'Ya existe otra entrada activa de este producto con la misma unidad.',
        )
      }

      await db.shoppingItems.put({
        ...item,
        quantity: input.quantity,
        quantityMax: input.quantityMax,
        unit,
        updatedAt: new Date().toISOString(),
        version: item.version + 1,
      })
    },
  )

  publishCommittedMutation('nutrition')
}

export async function toggleShoppingItemChecked(
  itemId: string,
) {
  await db.transaction(
    'rw',
    db.ingredients,
    db.shoppingItems,
    async () => {
      const item = await db.shoppingItems.get(itemId)

      if (!item || item.deletedAt !== null) {
        throw new Error('Producto no encontrado.')
      }

      const ingredient = await db.ingredients.get(item.ingredientId)
      if (!ingredient || ingredient.deletedAt !== null) {
        throw new Error('El producto asociado ya no está disponible.')
      }

      await db.shoppingItems.put({
        ...item,
        checked: !item.checked,
        updatedAt: new Date().toISOString(),
        version: item.version + 1,
      })
    },
  )

  publishCommittedMutation('nutrition')
}

export async function removeShoppingItem(
  itemId: string,
) {
  const changed = await db.transaction(
    'rw',
    db.shoppingItems,
    async () => {
      const item = await db.shoppingItems.get(itemId)

      if (!item || item.deletedAt !== null) {
        return false
      }

      const now = new Date().toISOString()
      await db.shoppingItems.put({
        ...item,
        deletedAt: now,
        updatedAt: now,
        version: item.version + 1,
      })
      return true
    },
  )

  if (changed) {
    publishCommittedMutation('nutrition')
  }
}

export async function clearCheckedShoppingItems() {
  const changed = await db.transaction(
    'rw',
    db.shoppingItems,
    async () => {
      const items = await db.shoppingItems.toArray()
      const checkedItems = items.filter(
        (item) => item.deletedAt === null && item.checked,
      )

      if (checkedItems.length === 0) {
        return false
      }

      const now = new Date().toISOString()
      for (const item of checkedItems) {
        await db.shoppingItems.put({
          ...item,
          deletedAt: now,
          updatedAt: now,
          version: item.version + 1,
        })
      }

      return true
    },
  )

  if (changed) {
    publishCommittedMutation('nutrition')
  }
}
