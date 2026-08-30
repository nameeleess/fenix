import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react'

import type {
  Ingredient,
  IngredientCategory,
  NutritionCategory,
  PreparationState,
  RecipeIngredient,
} from '../../types/nutrition'

import {
  addCatalogIngredientToBasket,
  addRecipeIngredientToBasket,
  clearCheckedShoppingItems,
  createCatalogIngredient,
  createRecipe,
  deleteCatalogIngredient,
  deleteRecipe,
  duplicateRecipe,
  getIngredientCatalog,
  getNutritionRecipes,
  getShoppingList,
  removeShoppingItem,
  toggleRecipeFavorite,
  toggleShoppingItemChecked,
  updateCatalogIngredient,
  updateRecipe,
  updateShoppingItem,
  type CatalogIngredientInput,
  type RecipeIngredientInput,
  type RecipeInput,
  type RecipeView,
  type ShoppingItemInput,
  type ShoppingItemView,
} from './nutritionService'

import './nutrition.css'

type NutritionSection =
  | 'recipes'
  | 'shopping'

type ShoppingView =
  | 'catalog'
  | 'basket'

type CategoryFilter =
  | 'all'
  | 'favorites'
  | NutritionCategory

type RecipeEditorTarget =
  | 'new'
  | RecipeView
  | null

type CatalogEditorTarget =
  | {
      mode: 'new'
      category: IngredientCategory
    }
  | {
      mode: 'edit'
      ingredient: Ingredient
    }
  | null

interface EditableRecipeIngredient {
  key: string
  name: string
  category: IngredientCategory
  quantity: string
  quantityMax: string
  unit: string
  preparationState:
    | ''
    | PreparationState
  notes: string
}

const recipeCategories: Array<{
  id: NutritionCategory
  label: string
}> = [
  {
    id: 'breakfast',
    label: 'Desayuno',
  },
  {
    id: 'preworkout',
    label: 'Pre-entreno',
  },
  {
    id: 'work_snack',
    label: 'Snack trabajo',
  },
  {
    id: 'main_meal',
    label: 'Comida principal',
  },
  {
    id: 'bedtime',
    label: 'Antes de dormir',
  },
  {
    id: 'shake',
    label: 'Batido',
  },
]

const filterCategories = [
  {
    id: 'all',
    label: 'Todas',
  },
  {
    id: 'favorites',
    label: 'Favoritas',
  },
  ...recipeCategories,
] as Array<{
  id: CategoryFilter
  label: string
}>

const ingredientCategoryOrder:
  IngredientCategory[] = [
    'protein',
    'carbohydrate',
    'fat',
    'dairy',
    'fruit_vegetable',
    'pantry',
    'supplement',
    'other',
  ]

const ingredientCategoryNames:
  Record<
    IngredientCategory,
    string
  > = {
    protein: 'Proteínas',
    carbohydrate:
      'Carbohidratos',
    fat: 'Grasas',
    dairy: 'Lácteos',
    fruit_vegetable:
      'Fruta y verdura',
    pantry: 'Despensa',
    supplement: 'Suplementos',
    other: 'Otros',
  }

const recipeCategoryNames:
  Record<
    NutritionCategory,
    string
  > = {
    breakfast: 'Desayuno',
    preworkout: 'Pre-entreno',
    work_snack:
      'Snack trabajo',
    main_meal:
      'Comida principal',
    bedtime:
      'Antes de dormir',
    shake: 'Batido',
  }

function formatNumber(
  value: number,
) {
  return new Intl.NumberFormat(
    'es-ES',
    {
      maximumFractionDigits: 1,
    },
  ).format(value)
}

function parseOptionalNumber(
  value: string,
  label: string,
) {
  const normalized =
    value
      .replace(',', '.')
      .trim()

  if (!normalized) {
    return null
  }

  const parsed =
    Number(normalized)

  if (
    !Number.isFinite(parsed) ||
    parsed < 0
  ) {
    throw new Error(
      `${label} debe ser un número válido.`,
    )
  }

  return parsed
}

function formatQuantity(
  item: RecipeIngredient,
) {
  let amount: string

  if (
    item.quantity !== null &&
    item.quantityMax !== null
  ) {
    amount =
      `${formatNumber(
        item.quantity,
      )}–${formatNumber(
        item.quantityMax,
      )}`
  } else if (
    item.quantity !== null
  ) {
    amount =
      formatNumber(
        item.quantity,
      )
  } else {
    amount =
      'Cantidad necesaria'
  }

  if (item.unit) {
    amount +=
      ` ${item.unit}`
  }

  const state =
    item.preparationState ===
    'dry'
      ? 'seco'
      : item.preparationState ===
          'cooked'
        ? 'cocido'
        : item.preparationState ===
            'drained'
          ? 'escurrido'
          : null

  if (state) {
    amount +=
      ` · ${state}`
  }

  return amount
}

function formatShoppingQuantity(
  item: ShoppingItemView,
) {
  if (
    item.item.quantity !== null &&
    item.item.quantityMax !== null
  ) {
    return `${formatNumber(
      item.item.quantity,
    )}–${formatNumber(
      item.item.quantityMax,
    )}${
      item.item.unit
        ? ` ${item.item.unit}`
        : ''
    }`
  }

  if (
    item.item.quantity !== null
  ) {
    return `${formatNumber(
      item.item.quantity,
    )}${
      item.item.unit
        ? ` ${item.item.unit}`
        : ''
    }`
  }

  return 'Cantidad pendiente'
}

function blankRecipeIngredient():
  EditableRecipeIngredient {
  return {
    key:
      crypto.randomUUID(),
    name: '',
    category: 'other',
    quantity: '',
    quantityMax: '',
    unit: '',
    preparationState: '',
    notes: '',
  }
}

function MacroSummary({
  item,
}: {
  item: RecipeView
}) {
  return (
    <div className="nutrition-macros">
      <div>
        <strong>
          {item.recipe
            .estimatedCalories ??
            '—'}
        </strong>
        <span>kcal</span>
      </div>

      <div>
        <strong>
          {item.recipe
            .estimatedProtein ??
            '—'}
        </strong>
        <span>P</span>
      </div>

      <div>
        <strong>
          {item.recipe
            .estimatedCarbs ??
            '—'}
        </strong>
        <span>C</span>
      </div>

      <div>
        <strong>
          {item.recipe
            .estimatedFat ??
            '—'}
        </strong>
        <span>G</span>
      </div>
    </div>
  )
}

function RecipeCard({
  item,
  onOpen,
  onFavorite,
}: {
  item: RecipeView
  onOpen: (
    item: RecipeView,
  ) => void
  onFavorite: (
    item: RecipeView,
  ) => Promise<void>
}) {
  return (
    <article className="nutrition-recipe-card">
      <div className="nutrition-recipe-card__top">
        <div>
          <p className="nutrition-eyebrow">
            {
              recipeCategoryNames[
                item.recipe.category
              ]
            }
          </p>

          <h2>
            {item.recipe.name}
          </h2>
        </div>

        <button
          type="button"
          className={`favorite-button ${
            item.recipe.isFavorite
              ? 'favorite-button--active'
              : ''
          }`}
          onClick={() =>
            void onFavorite(
              item,
            )
          }
        >
          {item.recipe.isFavorite
            ? '★'
            : '☆'}
        </button>
      </div>

      <MacroSummary
        item={item}
      />

      <div className="recipe-card-footer">
        <span>
          {item.ingredients.length}{' '}
          ingredientes
        </span>

        <button
          type="button"
          onClick={() =>
            onOpen(item)
          }
        >
          Ver receta
        </button>
      </div>
    </article>
  )
}

function RecipeEditor({
  item,
  catalog,
  onCancel,
  onSaved,
}: {
  item: RecipeView | null
  catalog: Ingredient[]
  onCancel: () => void
  onSaved: (
    recipeId: string,
  ) => Promise<void>
}) {
  const [
    name,
    setName,
  ] = useState(
    item?.recipe.name ?? '',
  )

  const [
    category,
    setCategory,
  ] =
    useState<NutritionCategory>(
      item?.recipe.category ??
      'main_meal',
    )

  const [
    calories,
    setCalories,
  ] = useState(
    item?.recipe
      .estimatedCalories
      ?.toString() ?? '',
  )

  const [
    protein,
    setProtein,
  ] = useState(
    item?.recipe
      .estimatedProtein
      ?.toString() ?? '',
  )

  const [
    carbs,
    setCarbs,
  ] = useState(
    item?.recipe
      .estimatedCarbs
      ?.toString() ?? '',
  )

  const [
    fat,
    setFat,
  ] = useState(
    item?.recipe
      .estimatedFat
      ?.toString() ?? '',
  )

  const [
    instructions,
    setInstructions,
  ] = useState(
    item?.recipe.instructions ??
      '',
  )

  const [
    notes,
    setNotes,
  ] = useState(
    item?.recipe.notes ?? '',
  )

  const [
    ingredients,
    setIngredients,
  ] =
    useState<
      EditableRecipeIngredient[]
    >(
      item
        ? item.ingredients.map(
            ({
              relation,
              ingredient,
            }) => ({
              key:
                crypto.randomUUID(),
              name:
                ingredient.name,
              category:
                ingredient.category,
              quantity:
                relation.quantity
                  ?.toString() ??
                '',
              quantityMax:
                relation.quantityMax
                  ?.toString() ??
                '',
              unit:
                relation.unit ?? '',
              preparationState:
                relation.preparationState ??
                '',
              notes:
                relation.notes ??
                '',
            }),
          )
        : [
            blankRecipeIngredient(),
          ],
    )

  const [
    error,
    setError,
  ] = useState('')

  const [
    saving,
    setSaving,
  ] = useState(false)

  function changeIngredient(
    key: string,
    changes:
      Partial<EditableRecipeIngredient>,
  ) {
    setIngredients(
      (current) =>
        current.map(
          (ingredient) =>
            ingredient.key === key
              ? {
                  ...ingredient,
                  ...changes,
                }
              : ingredient,
        ),
    )
  }

  function removeIngredient(
    key: string,
  ) {
    setIngredients(
      (current) =>
        current.filter(
          (ingredient) =>
            ingredient.key !==
            key,
        ),
    )
  }

  async function handleSubmit(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    try {
      setSaving(true)
      setError('')

      const recipeIngredients:
        RecipeIngredientInput[] =
        ingredients.map(
          (
            ingredient,
            index,
          ) => ({
            name:
              ingredient.name,
            category:
              ingredient.category,
            quantity:
              parseOptionalNumber(
                ingredient.quantity,
                `Cantidad ${index + 1}`,
              ),
            quantityMax:
              parseOptionalNumber(
                ingredient.quantityMax,
                `Cantidad máxima ${index + 1}`,
              ),
            unit:
              ingredient.unit
                .trim() ||
              null,
            preparationState:
              ingredient.preparationState ||
              null,
            notes:
              ingredient.notes
                .trim() ||
              null,
          }),
        )

      const input:
        RecipeInput = {
        name,
        category,
        estimatedCalories:
          parseOptionalNumber(
            calories,
            'Calorías',
          ),
        estimatedProtein:
          parseOptionalNumber(
            protein,
            'Proteína',
          ),
        estimatedCarbs:
          parseOptionalNumber(
            carbs,
            'Carbohidratos',
          ),
        estimatedFat:
          parseOptionalNumber(
            fat,
            'Grasas',
          ),
        instructions:
          instructions.trim() ||
          null,
        notes:
          notes.trim() ||
          null,
        ingredients:
          recipeIngredients,
      }

      const saved =
        item
          ? await updateRecipe(
              item.recipe.id,
              input,
            )
          : await createRecipe(
              input,
            )

      await onSaved(
        saved.id,
      )
    } catch (
      saveError
    ) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'No se ha podido guardar.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      className="recipe-editor"
      onSubmit={
        handleSubmit
      }
    >
      <button
        type="button"
        className="nutrition-back-button"
        onClick={onCancel}
      >
        ← Cancelar
      </button>

      <header className="recipe-editor__header">
        <p className="nutrition-eyebrow">
          {item
            ? 'EDITAR RECETA'
            : 'NUEVA RECETA'}
        </p>

        <h1>
          {item
            ? item.recipe.name
            : 'Crear receta'}
        </h1>
      </header>

      {error && (
        <div className="nutrition-error">
          {error}
        </div>
      )}

      <section className="editor-card">
        <label className="recipe-field">
          <span>
            Nombre
          </span>

          <input
            value={name}
            onChange={(
              event,
            ) =>
              setName(
                event.target.value,
              )
            }
          />
        </label>

        <label className="recipe-field">
          <span>
            Categoría
          </span>

          <select
            value={category}
            onChange={(
              event,
            ) =>
              setCategory(
                event.target
                  .value as
                  NutritionCategory,
              )
            }
          >
            {recipeCategories.map(
              (option) => (
                <option
                  key={
                    option.id
                  }
                  value={
                    option.id
                  }
                >
                  {
                    option.label
                  }
                </option>
              ),
            )}
          </select>
        </label>
      </section>

      <section className="editor-card">
        <h2>
          Macros estimados
        </h2>

        <div className="recipe-macro-form">
          <label>
            <span>kcal</span>
            <input
              value={calories}
              inputMode="decimal"
              onChange={(
                event,
              ) =>
                setCalories(
                  event.target
                    .value,
                )
              }
            />
          </label>

          <label>
            <span>Proteína</span>
            <input
              value={protein}
              inputMode="decimal"
              onChange={(
                event,
              ) =>
                setProtein(
                  event.target
                    .value,
                )
              }
            />
          </label>

          <label>
            <span>Carbs</span>
            <input
              value={carbs}
              inputMode="decimal"
              onChange={(
                event,
              ) =>
                setCarbs(
                  event.target
                    .value,
                )
              }
            />
          </label>

          <label>
            <span>Grasas</span>
            <input
              value={fat}
              inputMode="decimal"
              onChange={(
                event,
              ) =>
                setFat(
                  event.target
                    .value,
                )
              }
            />
          </label>
        </div>
      </section>

      <section className="editor-card">
        <div className="section-title-row">
          <h2>
            Ingredientes
          </h2>

          <button
            type="button"
            onClick={() =>
              setIngredients(
                (current) => [
                  ...current,
                  blankRecipeIngredient(),
                ],
              )
            }
          >
            + Ingrediente
          </button>
        </div>

        <datalist id="fenix-ingredients">
          {catalog.map(
            (ingredient) => (
              <option
                key={
                  ingredient.id
                }
                value={
                  ingredient.name
                }
              />
            ),
          )}
        </datalist>

        <div className="recipe-editor-ingredients">
          {ingredients.map(
            (
              ingredient,
              index,
            ) => (
              <article
                className="recipe-editor-ingredient"
                key={
                  ingredient.key
                }
              >
                <div className="ingredient-editor-header">
                  <strong>
                    Ingrediente{' '}
                    {index + 1}
                  </strong>

                  <button
                    type="button"
                    onClick={() =>
                      removeIngredient(
                        ingredient.key,
                      )
                    }
                  >
                    ×
                  </button>
                </div>

                <label className="recipe-field">
                  <span>
                    Nombre
                  </span>

                  <input
                    list="fenix-ingredients"
                    value={
                      ingredient.name
                    }
                    onChange={(
                      event,
                    ) =>
                      changeIngredient(
                        ingredient.key,
                        {
                          name:
                            event
                              .target
                              .value,
                        },
                      )
                    }
                  />
                </label>

                <label className="recipe-field">
                  <span>
                    Grupo
                  </span>

                  <select
                    value={
                      ingredient.category
                    }
                    onChange={(
                      event,
                    ) =>
                      changeIngredient(
                        ingredient.key,
                        {
                          category:
                            event
                              .target
                              .value as
                              IngredientCategory,
                        },
                      )
                    }
                  >
                    {ingredientCategoryOrder.map(
                      (
                        group,
                      ) => (
                        <option
                          key={
                            group
                          }
                          value={
                            group
                          }
                        >
                          {
                            ingredientCategoryNames[
                              group
                            ]
                          }
                        </option>
                      ),
                    )}
                  </select>
                </label>

                <div className="ingredient-amount-grid">
                  <label className="recipe-field">
                    <span>
                      Cantidad
                    </span>

                    <input
                      inputMode="decimal"
                      value={
                        ingredient.quantity
                      }
                      onChange={(
                        event,
                      ) =>
                        changeIngredient(
                          ingredient.key,
                          {
                            quantity:
                              event
                                .target
                                .value,
                          },
                        )
                      }
                    />
                  </label>

                  <label className="recipe-field">
                    <span>
                      Máx.
                    </span>

                    <input
                      inputMode="decimal"
                      value={
                        ingredient.quantityMax
                      }
                      onChange={(
                        event,
                      ) =>
                        changeIngredient(
                          ingredient.key,
                          {
                            quantityMax:
                              event
                                .target
                                .value,
                          },
                        )
                      }
                    />
                  </label>

                  <label className="recipe-field">
                    <span>
                      Unidad
                    </span>

                    <input
                      value={
                        ingredient.unit
                      }
                      onChange={(
                        event,
                      ) =>
                        changeIngredient(
                          ingredient.key,
                          {
                            unit:
                              event
                                .target
                                .value,
                          },
                        )
                      }
                    />
                  </label>
                </div>

                <label className="recipe-field">
                  <span>
                    Estado
                  </span>

                  <select
                    value={
                      ingredient.preparationState
                    }
                    onChange={(
                      event,
                    ) =>
                      changeIngredient(
                        ingredient.key,
                        {
                          preparationState:
                            event
                              .target
                              .value as
                              | ''
                              | PreparationState,
                        },
                      )
                    }
                  >
                    <option value="">
                      Sin especificar
                    </option>
                    <option value="dry">
                      Seco
                    </option>
                    <option value="cooked">
                      Cocido
                    </option>
                    <option value="drained">
                      Escurrido
                    </option>
                  </select>
                </label>
              </article>
            ),
          )}
        </div>
      </section>

      <section className="editor-card">
        <label className="recipe-field">
          <span>
            Preparación
          </span>

          <textarea
            rows={5}
            value={
              instructions
            }
            onChange={(
              event,
            ) =>
              setInstructions(
                event.target
                  .value,
              )
            }
          />
        </label>

        <label className="recipe-field">
          <span>
            Notas
          </span>

          <textarea
            rows={3}
            value={notes}
            onChange={(
              event,
            ) =>
              setNotes(
                event.target.value,
              )
            }
          />
        </label>
      </section>

      <button
        type="submit"
        className="nutrition-primary-button"
        disabled={saving}
      >
        {saving
          ? 'Guardando…'
          : item
            ? 'Guardar cambios'
            : 'Crear receta'}
      </button>
    </form>
  )
}

function CatalogEditor({
  target,
  onCancel,
  onSaved,
}: {
  target:
    Exclude<
      CatalogEditorTarget,
      null
    >
  onCancel: () => void
  onSaved: () => Promise<void>
}) {
  const isEdit =
    target.mode === 'edit'

  const initialIngredient =
    isEdit
      ? target.ingredient
      : null

  const [
    name,
    setName,
  ] = useState(
    initialIngredient?.name ??
      '',
  )

  const [
    category,
    setCategory,
  ] =
    useState<IngredientCategory>(
      initialIngredient
        ?.category ??
      (target.mode === 'new'
        ? target.category
        : 'other'),
    )

  const [
    unit,
    setUnit,
  ] = useState(
    initialIngredient
      ?.defaultUnit ??
      '',
  )

  const [
    notes,
    setNotes,
  ] = useState(
    initialIngredient?.notes ??
      '',
  )

  const [
    error,
    setError,
  ] = useState('')

  async function submit(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    try {
      setError('')

      const input:
        CatalogIngredientInput = {
        name,
        category,
        defaultUnit:
          unit.trim() || null,
        notes:
          notes.trim() || null,
      }

      if (
        target.mode === 'edit'
      ) {
        await updateCatalogIngredient(
          target.ingredient.id,
          input,
        )
      } else {
        await createCatalogIngredient(
          input,
        )
      }

      await onSaved()
    } catch (
      saveError
    ) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'No se ha podido guardar.',
      )
    }
  }

  return (
    <form
      className="catalog-editor"
      onSubmit={submit}
    >
      <div className="section-title-row">
        <div>
          <p className="nutrition-eyebrow">
            CATÁLOGO
          </p>
          <h2>
            {isEdit
              ? 'Editar producto'
              : 'Nuevo producto'}
          </h2>
        </div>

        <button
          type="button"
          className="close-editor-button"
          onClick={onCancel}
        >
          ×
        </button>
      </div>

      {error && (
        <div className="nutrition-error">
          {error}
        </div>
      )}

      <label className="recipe-field">
        <span>
          Producto
        </span>
        <input
          value={name}
          onChange={(
            event,
          ) =>
            setName(
              event.target.value,
            )
          }
        />
      </label>

      <label className="recipe-field">
        <span>
          Grupo
        </span>

        <select
          value={category}
          onChange={(
            event,
          ) =>
            setCategory(
              event.target
                .value as
                IngredientCategory,
            )
          }
        >
          {ingredientCategoryOrder.map(
            (group) => (
              <option
                key={group}
                value={group}
              >
                {
                  ingredientCategoryNames[
                    group
                  ]
                }
              </option>
            ),
          )}
        </select>
      </label>

      <label className="recipe-field">
  <span>
    Unidad habitual
  </span>

  <input
    value={unit}
    placeholder="g, ml, ud..."
    onChange={(
      event,
    ) =>
      setUnit(
        event.target.value,
      )
    }
  />
</label>

<label className="recipe-field">
  <span>
    Notas
  </span>

  <textarea
    rows={3}
    value={notes}
    placeholder="Notas opcionales..."
    onChange={(
      event,
    ) =>
      setNotes(
        event.target.value,
      )
    }
  />
</label>

<button
  className="nutrition-primary-button compact"
  type="submit"
>
  Guardar producto
</button>
    </form>
  )
}

function RecipeDetail({
  item,
  message,
  onBack,
  onFavorite,
  onEdit,
  onDuplicate,
  onDelete,
  onAddIngredient,
}: {
  item: RecipeView
  message: string
  onBack: () => void
  onFavorite: (
    item: RecipeView,
  ) => Promise<void>
  onEdit: () => void
  onDuplicate:
    () => Promise<void>
  onDelete:
    () => Promise<void>
  onAddIngredient: (
    relationId: string,
  ) => Promise<void>
}) {
  return (
    <div>
      <button
        type="button"
        className="nutrition-back-button"
        onClick={onBack}
      >
        ← Recetas
      </button>

      <header className="nutrition-detail__header">
        <div>
          <p className="nutrition-eyebrow">
            {
              recipeCategoryNames[
                item.recipe.category
              ]
            }
          </p>

          <h1>
            {item.recipe.name}
          </h1>
        </div>

        <button
          type="button"
          className={`favorite-button ${
            item.recipe.isFavorite
              ? 'favorite-button--active'
              : ''
          }`}
          onClick={() =>
            void onFavorite(
              item,
            )
          }
        >
          {item.recipe.isFavorite
            ? '★'
            : '☆'}
        </button>
      </header>

      <div className="recipe-management-actions">
        <button
          type="button"
          onClick={onEdit}
        >
          Editar
        </button>

        <button
          type="button"
          onClick={() =>
            void onDuplicate()
          }
        >
          Duplicar
        </button>

        <button
          type="button"
          className="danger"
          onClick={() =>
            void onDelete()
          }
        >
          Eliminar
        </button>
      </div>

      <MacroSummary
        item={item}
      />

      <section className="nutrition-detail-section">
        <h2>
          Ingredientes
        </h2>

        <div className="ingredient-list">
          {item.ingredients.map(
            ({
              relation,
              ingredient,
            }) => (
              <div
                className="ingredient-row"
                key={
                  relation.id
                }
              >
                <div>
                  <strong>
                    {
                      ingredient.name
                    }
                  </strong>

                  {relation.notes && (
                    <small>
                      {
                        relation.notes
                      }
                    </small>
                  )}
                </div>

                <div className="ingredient-action-area">
                  <span>
                    {formatQuantity(
                      relation,
                    )}
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      void onAddIngredient(
                        relation.id,
                      )
                    }
                  >
                    +
                  </button>
                </div>
              </div>
            ),
          )}
        </div>
      </section>

      {item.recipe.instructions && (
        <section className="nutrition-detail-section">
          <h2>
            Preparación
          </h2>

          <p className="nutrition-instructions">
            {
              item.recipe
                .instructions
            }
          </p>
        </section>
      )}

      {message && (
        <p className="nutrition-success">
          {message}
        </p>
      )}
    </div>
  )
}

function BasketEditor({
  item,
  onCancel,
  onSaved,
}: {
  item: ShoppingItemView
  onCancel: () => void
  onSaved: () => Promise<void>
}) {
  const [
    quantity,
    setQuantity,
  ] = useState(
    item.item.quantity
      ?.toString() ?? '',
  )

  const [
    quantityMax,
    setQuantityMax,
  ] = useState(
    item.item.quantityMax
      ?.toString() ?? '',
  )

  const [
    unit,
    setUnit,
  ] = useState(
    item.item.unit ?? '',
  )

  const [
    error,
    setError,
  ] = useState('')

  async function submit(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    try {
      setError('')

      const input:
        ShoppingItemInput = {
        quantity:
          parseOptionalNumber(
            quantity,
            'Cantidad',
          ),
        quantityMax:
          parseOptionalNumber(
            quantityMax,
            'Cantidad máxima',
          ),
        unit:
          unit.trim() || null,
      }

      await updateShoppingItem(
        item.item.id,
        input,
      )

      await onSaved()
    } catch (
      saveError
    ) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'No se ha podido guardar.',
      )
    }
  }

  return (
    <form
      className="basket-editor"
      onSubmit={submit}
    >
      <div className="section-title-row">
        <h3>
          {item.ingredient.name}
        </h3>

        <button
          type="button"
          className="close-editor-button"
          onClick={onCancel}
        >
          ×
        </button>
      </div>

      {error && (
        <div className="nutrition-error">
          {error}
        </div>
      )}

      <div className="basket-editor-grid">
        <label className="recipe-field">
          <span>
            Cantidad
          </span>
          <input
            inputMode="decimal"
            value={quantity}
            onChange={(
              event,
            ) =>
              setQuantity(
                event.target
                  .value,
              )
            }
          />
        </label>

        <label className="recipe-field">
          <span>
            Máx.
          </span>
          <input
            inputMode="decimal"
            value={quantityMax}
            onChange={(
              event,
            ) =>
              setQuantityMax(
                event.target
                  .value,
              )
            }
          />
        </label>

        <label className="recipe-field">
          <span>
            Unidad
          </span>
          <input
            value={unit}
            onChange={(
              event,
            ) =>
              setUnit(
                event.target.value,
              )
            }
          />
        </label>
      </div>

      <button
        className="nutrition-primary-button compact"
        type="submit"
      >
        Guardar
      </button>
    </form>
  )
}

export default function NutritionPage() {
  const [
    recipes,
    setRecipes,
  ] =
    useState<RecipeView[]>([])

  const [
    catalog,
    setCatalog,
  ] =
    useState<Ingredient[]>([])

  const [
    basket,
    setBasket,
  ] =
    useState<
      ShoppingItemView[]
    >([])

  const [
    selectedRecipe,
    setSelectedRecipe,
  ] =
    useState<
      RecipeView | null
    >(null)

  const [
    recipeEditor,
    setRecipeEditor,
  ] =
    useState<RecipeEditorTarget>(
      null,
    )

  const [
    catalogEditor,
    setCatalogEditor,
  ] =
    useState<CatalogEditorTarget>(
      null,
    )

  const [
    basketEditor,
    setBasketEditor,
  ] =
    useState<
      ShoppingItemView | null
    >(null)

  const [
    section,
    setSection,
  ] =
    useState<NutritionSection>(
      'recipes',
    )

  const [
    shoppingView,
    setShoppingView,
  ] =
    useState<ShoppingView>(
      'catalog',
    )

  const [
    category,
    setCategory,
  ] =
    useState<CategoryFilter>(
      'all',
    )

  const [
    search,
    setSearch,
  ] = useState('')

  const [
    loading,
    setLoading,
  ] = useState(true)

  const [
    error,
    setError,
  ] = useState('')

  const [
    message,
    setMessage,
  ] = useState('')

  useEffect(() => {
    let active = true

    Promise.all([
      getNutritionRecipes(),
      getIngredientCatalog(),
      getShoppingList(),
    ])
      .then(
        ([
          loadedRecipes,
          loadedCatalog,
          loadedBasket,
        ]) => {
          if (!active) {
            return
          }

          setRecipes(
            loadedRecipes,
          )
          setCatalog(
            loadedCatalog,
          )
          setBasket(
            loadedBasket,
          )
          setLoading(false)
        },
      )
      .catch(
        (
          loadError: unknown,
        ) => {
          if (!active) {
            return
          }

          setError(
            loadError instanceof Error
              ? loadError.message
              : 'No se ha podido cargar Nutrition.',
          )
          setLoading(false)
        },
      )

    return () => {
      active = false
    }
  }, [])

  const filteredRecipes =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLocaleLowerCase(
            'es',
          )

      return recipes.filter(
        (item) => {
          if (
            category ===
              'favorites' &&
            !item.recipe
              .isFavorite
          ) {
            return false
          }

          if (
            category !== 'all' &&
            category !==
              'favorites' &&
            item.recipe.category !==
              category
          ) {
            return false
          }

          if (!query) {
            return true
          }

          return (
            item.recipe.name
              .toLocaleLowerCase(
                'es',
              )
              .includes(query) ||
            item.ingredients.some(
              ({
                ingredient,
              }) =>
                ingredient.name
                  .toLocaleLowerCase(
                    'es',
                  )
                  .includes(
                    query,
                  ),
            )
          )
        },
      )
    }, [
      recipes,
      category,
      search,
    ])

  async function refreshAll() {
    const [
      loadedRecipes,
      loadedCatalog,
      loadedBasket,
    ] =
      await Promise.all([
        getNutritionRecipes(),
        getIngredientCatalog(),
        getShoppingList(),
      ])

    setRecipes(
      loadedRecipes,
    )
    setCatalog(
      loadedCatalog,
    )
    setBasket(
      loadedBasket,
    )

    return loadedRecipes
  }

  async function saveRecipe(
    recipeId: string,
  ) {
    const loaded =
      await refreshAll()

    setRecipeEditor(null)

    const saved =
      loaded.find(
        (item) =>
          item.recipe.id ===
          recipeId,
      )

    setSelectedRecipe(
      saved ?? null,
    )
  }

  async function toggleFavorite(
    item: RecipeView,
  ) {
    const updated =
      await toggleRecipeFavorite(
        item.recipe.id,
      )

    setRecipes(
      (current) =>
        current.map(
          (recipe) =>
            recipe.recipe.id ===
            updated.id
              ? {
                  ...recipe,
                  recipe:
                    updated,
                }
              : recipe,
        ),
    )

    setSelectedRecipe(
      (current) =>
        current?.recipe.id ===
        updated.id
          ? {
              ...current,
              recipe:
                updated,
            }
          : current,
    )
  }

  if (loading) {
    return (
      <main className="nutrition-page">
        Cargando Nutrition…
      </main>
    )
  }

  if (recipeEditor) {
    return (
      <main className="nutrition-page">
        <RecipeEditor
          key={
            recipeEditor ===
            'new'
              ? 'new'
              : recipeEditor
                  .recipe.id
          }
          item={
            recipeEditor ===
            'new'
              ? null
              : recipeEditor
          }
          catalog={catalog}
          onCancel={() =>
            setRecipeEditor(
              null,
            )
          }
          onSaved={saveRecipe}
        />
      </main>
    )
  }

  if (selectedRecipe) {
    return (
      <main className="nutrition-page">
        {error && (
          <div className="nutrition-error">
            {error}
          </div>
        )}

        <RecipeDetail
          item={selectedRecipe}
          message={message}
          onBack={() => {
            setSelectedRecipe(
              null,
            )
            setMessage('')
          }}
          onFavorite={
            toggleFavorite
          }
          onEdit={() =>
            setRecipeEditor(
              selectedRecipe,
            )
          }
          onDuplicate={async () => {
            const duplicated =
              await duplicateRecipe(
                selectedRecipe
                  .recipe.id,
              )

            const loaded =
              await refreshAll()

            setSelectedRecipe(
              loaded.find(
                (item) =>
                  item.recipe.id ===
                  duplicated.id,
              ) ?? null,
            )
          }}
          onDelete={async () => {
            if (
              !window.confirm(
                '¿Eliminar esta receta?',
              )
            ) {
              return
            }

            await deleteRecipe(
              selectedRecipe
                .recipe.id,
            )

            await refreshAll()

            setSelectedRecipe(
              null,
            )
          }}
          onAddIngredient={async (
            relationId,
          ) => {
            await addRecipeIngredientToBasket(
              relationId,
            )

            setBasket(
              await getShoppingList(),
            )

            setMessage(
              'Añadido al carrito.',
            )
          }}
        />
      </main>
    )
  }

  return (
    <main className="nutrition-page">
      <header className="nutrition-header">
        <p className="nutrition-eyebrow">
          FÉNIX
        </p>
        <h1>
          Nutrition
        </h1>
        <p>
          Recetas y compra bajo tu control.
        </p>
      </header>

      {error && (
        <div className="nutrition-error">
          {error}
        </div>
      )}

      <nav className="nutrition-tabs">
        <button
          type="button"
          className={
            section ===
            'recipes'
              ? 'active'
              : ''
          }
          onClick={() =>
            setSection(
              'recipes',
            )
          }
        >
          Recetas
        </button>

        <button
          type="button"
          className={
            section ===
            'shopping'
              ? 'active'
              : ''
          }
          onClick={() =>
            setSection(
              'shopping',
            )
          }
        >
          Compra
        </button>
      </nav>

      {section === 'recipes' ? (
        <>
          <div className="recipes-toolbar">
            <label className="nutrition-search">
              <span>
                Buscar
              </span>

              <input
                type="search"
                placeholder="Receta o ingrediente..."
                value={search}
                onChange={(
                  event,
                ) =>
                  setSearch(
                    event.target
                      .value,
                  )
                }
              />
            </label>

            <button
              type="button"
              className="new-recipe-button"
              onClick={() =>
                setRecipeEditor(
                  'new',
                )
              }
            >
              + Nueva receta
            </button>
          </div>

          <div className="nutrition-categories">
            {filterCategories.map(
              (filter) => (
                <button
                  type="button"
                  key={
                    filter.id
                  }
                  className={
                    category ===
                    filter.id
                      ? 'active'
                      : ''
                  }
                  onClick={() =>
                    setCategory(
                      filter.id,
                    )
                  }
                >
                  {
                    filter.label
                  }
                </button>
              ),
            )}
          </div>

          <div className="nutrition-results">
            {
              filteredRecipes.length
            }{' '}
            recetas
          </div>

          <section className="nutrition-recipe-grid">
            {filteredRecipes.map(
              (item) => (
                <RecipeCard
                  key={
                    item.recipe.id
                  }
                  item={item}
                  onOpen={
                    setSelectedRecipe
                  }
                  onFavorite={
                    toggleFavorite
                  }
                />
              ),
            )}
          </section>
        </>
      ) : shoppingView ===
        'catalog' ? (
        <>
          <div className="shopping-catalog-header">
            <div>
              <p className="nutrition-eyebrow">
                COMPRA
              </p>
              <h2>
                Catálogo
              </h2>
              <p>
                Tu lista permanente.
              </p>
            </div>

            <button
              type="button"
              className="cart-button"
              onClick={() =>
                setShoppingView(
                  'basket',
                )
              }
            >
              <span>
                🛒
              </span>

              {basket.length >
                0 && (
                <strong>
                  {
                    basket.length
                  }
                </strong>
              )}
            </button>
          </div>

          {catalogEditor && (
            <CatalogEditor
              key={
                catalogEditor.mode ===
                'new'
                  ? `new-${catalogEditor.category}`
                  : catalogEditor
                      .ingredient.id
              }
              target={
                catalogEditor
              }
              onCancel={() =>
                setCatalogEditor(
                  null,
                )
              }
              onSaved={async () => {
                await refreshAll()
                setCatalogEditor(
                  null,
                )
              }}
            />
          )}

          <div className="catalog-sections">
            {ingredientCategoryOrder.map(
              (group) => {
                const products =
                  catalog.filter(
                    (ingredient) =>
                      ingredient.category ===
                      group,
                  )

                return (
                  <section
                    className="catalog-section"
                    key={group}
                  >
                    <div className="catalog-section-header">
                      <h3>
                        {
                          ingredientCategoryNames[
                            group
                          ]
                        }
                      </h3>

                      <button
                        type="button"
                        onClick={() =>
                          setCatalogEditor(
                            {
                              mode: 'new',
                              category:
                                group,
                            },
                          )
                        }
                      >
                        +
                      </button>
                    </div>

                    {products.map(
                      (ingredient) => {
                        const alreadyInBasket =
                          basket.some(
                            (item) =>
                              item
                                .ingredient
                                .id ===
                              ingredient.id,
                          )

                        return (
                          <div
                            className="catalog-product-row"
                            key={
                              ingredient.id
                            }
                          >
                            <div>
                              <strong>
                                {
                                  ingredient.name
                                }
                              </strong>

                              {ingredient.defaultUnit && (
                                <span>
                                  {
                                    ingredient.defaultUnit
                                  }
                                </span>
                              )}
                            </div>

                            <div className="catalog-row-actions">
                              <button
                                type="button"
                                className="catalog-add"
                                disabled={
                                  alreadyInBasket
                                }
                                onClick={async () => {
                                  await addCatalogIngredientToBasket(
                                    ingredient.id,
                                  )

                                  setBasket(
                                    await getShoppingList(),
                                  )
                                }}
                              >
                                {alreadyInBasket
                                  ? '✓'
                                  : '+'}
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  setCatalogEditor(
                                    {
                                      mode: 'edit',
                                      ingredient,
                                    },
                                  )
                                }
                              >
                                ✎
                              </button>

                              <button
                                type="button"
                                className="catalog-delete"
                                onClick={async () => {
                                  if (
                                    !window.confirm(
                                      `¿Eliminar "${ingredient.name}" del catálogo?`,
                                    )
                                  ) {
                                    return
                                  }

                                  try {
                                    setError(
                                      '',
                                    )

                                    await deleteCatalogIngredient(
                                      ingredient.id,
                                    )

                                    await refreshAll()
                                  } catch (
                                    deleteError
                                  ) {
                                    setError(
                                      deleteError instanceof Error
                                        ? deleteError.message
                                        : 'No se ha podido eliminar.',
                                    )
                                  }
                                }}
                              >
                                ×
                              </button>
                            </div>
                          </div>
                        )
                      },
                    )}
                  </section>
                )
              },
            )}
          </div>
        </>
      ) : (
        <>
          <button
            type="button"
            className="nutrition-back-button"
            onClick={() =>
              setShoppingView(
                'catalog',
              )
            }
          >
            ← Catálogo
          </button>

          <div className="shopping-basket-header">
            <p className="nutrition-eyebrow">
              COMPRA
            </p>
            <h2>
              Carrito
            </h2>
            <p>
              Lo que te falta comprar.
            </p>
          </div>

          {basketEditor && (
            <BasketEditor
              key={
                basketEditor
                  .item.id
              }
              item={
                basketEditor
              }
              onCancel={() =>
                setBasketEditor(
                  null,
                )
              }
              onSaved={async () => {
                setBasket(
                  await getShoppingList(),
                )
                setBasketEditor(
                  null,
                )
              }}
            />
          )}

          {basket.length === 0 ? (
            <div className="nutrition-empty-state">
              Carrito vacío.
            </div>
          ) : (
            <div className="shopping-list">
              {basket.some(
                (item) =>
                  item.item.checked,
              ) && (
                <button
                  type="button"
                  className="clear-checked-button"
                  onClick={async () => {
                    await clearCheckedShoppingItems()

                    setBasket(
                      await getShoppingList(),
                    )
                  }}
                >
                  Limpiar comprados
                </button>
              )}

              {basket.map(
                (item) => (
                  <div
                    className={`shopping-row ${
                      item.item.checked
                        ? 'shopping-row--checked'
                        : ''
                    }`}
                    key={
                      item.item.id
                    }
                  >
                    <button
                      type="button"
                      className="shopping-check"
                      onClick={async () => {
                        await toggleShoppingItemChecked(
                          item.item.id,
                        )

                        setBasket(
                          await getShoppingList(),
                        )
                      }}
                    >
                      {item.item.checked
                        ? '✓'
                        : '○'}
                    </button>

                    <div className="shopping-info">
                      <strong>
                        {
                          item
                            .ingredient
                            .name
                        }
                      </strong>

                      <span>
                        {formatShoppingQuantity(
                          item,
                        )}
                      </span>
                    </div>

                    <button
                      type="button"
                      className="shopping-edit"
                      onClick={() =>
                        setBasketEditor(
                          item,
                        )
                      }
                    >
                      ✎
                    </button>

                    <button
                      type="button"
                      className="shopping-remove"
                      onClick={async () => {
                        await removeShoppingItem(
                          item.item.id,
                        )

                        setBasket(
                          await getShoppingList(),
                        )
                      }}
                    >
                      ×
                    </button>
                  </div>
                ),
              )}
            </div>
          )}
        </>
      )}
    </main>
  )
}