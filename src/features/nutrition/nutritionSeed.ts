import { db } from '../../db/database'
import type {
  Ingredient,
  IngredientCategory,
  NutritionCategory,
  PreparationState,
  Recipe,
  RecipeIngredient,
} from '../../types/nutrition'

const seedDate = '2026-08-30T00:00:00.000Z'
const nutritionSeedVersion = '1'

function base(id: string) {
  return {
    id,
    createdAt: seedDate,
    updatedAt: seedDate,
    deletedAt: null,
    version: 1,
  }
}

interface IngredientDefinition {
  id: string
  name: string
  category: IngredientCategory
  defaultUnit: string | null
  notes?: string | null
}

interface RecipeIngredientDefinition {
  ingredientId: string
  quantity: number | null
  quantityMax?: number | null
  unit: string | null
  preparationState?: PreparationState | null
  notes?: string | null
}

interface RecipeDefinition {
  id: string
  name: string
  category: NutritionCategory
  calories: number
  protein: number
  carbs: number
  fat: number
  ingredients: RecipeIngredientDefinition[]
  instructions?: string | null
  notes?: string | null
}

const ingredientDefinitions: IngredientDefinition[] = [
  {
    id: 'ing-rice-cream',
    name: 'Crema de arroz',
    category: 'carbohydrate',
    defaultUnit: 'g',
  },
  {
    id: 'ing-milk',
    name: 'Leche',
    category: 'dairy',
    defaultUnit: 'ml',
  },
  {
    id: 'ing-whey',
    name: 'Proteína whey',
    category: 'supplement',
    defaultUnit: 'g',
  },
  {
    id: 'ing-berries',
    name: 'Frutos del bosque',
    category: 'fruit_vegetable',
    defaultUnit: 'g',
  },
  {
    id: 'ing-peanut-butter',
    name: 'Crema de cacahuete',
    category: 'fat',
    defaultUnit: 'g',
  },
  {
    id: 'ing-greek-yogurt',
    name: 'Yogur griego 2%',
    category: 'dairy',
    defaultUnit: 'g',
  },
  {
    id: 'ing-oat-powder',
    name: 'Avena en polvo',
    category: 'carbohydrate',
    defaultUnit: 'g',
  },
  {
    id: 'ing-oats',
    name: 'Avena',
    category: 'carbohydrate',
    defaultUnit: 'g',
  },
  {
    id: 'ing-honey',
    name: 'Miel',
    category: 'pantry',
    defaultUnit: 'g',
  },
  {
    id: 'ing-walnuts',
    name: 'Nueces',
    category: 'fat',
    defaultUnit: 'g',
  },
  {
    id: 'ing-mixed-nuts',
    name: 'Frutos secos',
    category: 'fat',
    defaultUnit: 'g',
  },
  {
    id: 'ing-bread',
    name: 'Pan',
    category: 'carbohydrate',
    defaultUnit: 'g',
  },
  {
    id: 'ing-cream-cheese',
    name: 'Queso crema',
    category: 'dairy',
    defaultUnit: 'g',
  },
  {
    id: 'ing-jam',
    name: 'Mermelada',
    category: 'pantry',
    defaultUnit: 'g',
  },
  {
    id: 'ing-turkey',
    name: 'Pavo',
    category: 'protein',
    defaultUnit: 'g',
  },
  {
    id: 'ing-olive-oil',
    name: 'Aceite de oliva',
    category: 'fat',
    defaultUnit: 'g',
  },
  {
    id: 'ing-rice-cakes',
    name: 'Tortitas de arroz',
    category: 'carbohydrate',
    defaultUnit: 'ud',
  },
  {
    id: 'ing-banana',
    name: 'Plátano',
    category: 'fruit_vegetable',
    defaultUnit: 'ud',
  },
  {
    id: 'ing-eggs',
    name: 'Huevos',
    category: 'protein',
    defaultUnit: 'ud',
  },
  {
    id: 'ing-tuna',
    name: 'Atún',
    category: 'protein',
    defaultUnit: 'g',
  },
  {
    id: 'ing-light-mayo',
    name: 'Mayonesa ligera',
    category: 'pantry',
    defaultUnit: 'g',
  },
  {
    id: 'ing-mass-gainer',
    name: 'Mass gainer',
    category: 'supplement',
    defaultUnit: 'ración',
  },
  {
    id: 'ing-water',
    name: 'Agua',
    category: 'other',
    defaultUnit: null,
  },
  {
    id: 'ing-protein-yogurt-drink',
    name: 'Yogur líquido alto en proteína',
    category: 'dairy',
    defaultUnit: 'ud',
  },
  {
    id: 'ing-dates',
    name: 'Dátiles',
    category: 'fruit_vegetable',
    defaultUnit: 'g',
  },
  {
    id: 'ing-almonds',
    name: 'Almendras',
    category: 'fat',
    defaultUnit: 'g',
  },
  {
    id: 'ing-seed-bread',
    name: 'Pan de pipas',
    category: 'carbohydrate',
    defaultUnit: 'g',
  },
  {
    id: 'ing-dried-figs',
    name: 'Higos secos',
    category: 'fruit_vegetable',
    defaultUnit: 'g',
  },
  {
    id: 'ing-macaroni',
    name: 'Macarrones',
    category: 'carbohydrate',
    defaultUnit: 'g',
  },
  {
    id: 'ing-chicken',
    name: 'Pollo',
    category: 'protein',
    defaultUnit: 'g',
  },
  {
    id: 'ing-gratin-cheese',
    name: 'Queso para gratinar',
    category: 'dairy',
    defaultUnit: 'g',
  },
  {
    id: 'ing-tomato-sauce',
    name: 'Tomate frito',
    category: 'pantry',
    defaultUnit: 'g',
  },
  {
    id: 'ing-ground-meat',
    name: 'Carne picada',
    category: 'protein',
    defaultUnit: 'g',
  },
  {
    id: 'ing-pasta',
    name: 'Pasta',
    category: 'carbohydrate',
    defaultUnit: 'g',
  },
  {
    id: 'ing-corn',
    name: 'Maíz',
    category: 'carbohydrate',
    defaultUnit: 'g',
  },
  {
    id: 'ing-vegetables',
    name: 'Verduras variadas',
    category: 'fruit_vegetable',
    defaultUnit: 'g',
  },
  {
    id: 'ing-lentils',
    name: 'Lentejas',
    category: 'carbohydrate',
    defaultUnit: 'g',
  },
  {
    id: 'ing-rice',
    name: 'Arroz',
    category: 'carbohydrate',
    defaultUnit: 'g',
  },
  {
    id: 'ing-potato',
    name: 'Patata',
    category: 'carbohydrate',
    defaultUnit: 'g',
  },
  {
    id: 'ing-peas-carrots',
    name: 'Guisantes y zanahoria',
    category: 'fruit_vegetable',
    defaultUnit: 'g',
  },
  {
    id: 'ing-chickpeas',
    name: 'Garbanzos',
    category: 'carbohydrate',
    defaultUnit: 'g',
  },
  {
    id: 'ing-sofrito',
    name: 'Sofrito',
    category: 'pantry',
    defaultUnit: 'g',
  },
  {
    id: 'ing-mixed-vegetables',
    name: 'Menestra de verduras',
    category: 'fruit_vegetable',
    defaultUnit: 'g',
  },
  {
    id: 'ing-prawns',
    name: 'Gambas',
    category: 'protein',
    defaultUnit: 'g',
  },
  {
    id: 'ing-cocoa',
    name: 'Cacao puro',
    category: 'pantry',
    defaultUnit: 'g',
  },
  {
    id: 'ing-mango',
    name: 'Mango',
    category: 'fruit_vegetable',
    defaultUnit: 'g',
  },
  {
    id: 'ing-avocado',
    name: 'Aguacate',
    category: 'fat',
    defaultUnit: 'g',
  },
  {
    id: 'ing-spices',
    name: 'Especias',
    category: 'pantry',
    defaultUnit: null,
  },
  {
    id: 'ing-creatine',
    name: 'Creatina',
    category: 'supplement',
    defaultUnit: 'g',
  },
  {
    id: 'ing-omega-3',
    name: 'Omega-3',
    category: 'supplement',
    defaultUnit: null,
  },
  {
    id: 'ing-magnesium',
    name: 'Magnesio',
    category: 'supplement',
    defaultUnit: null,
  },
]

const recipeDefinitions: RecipeDefinition[] = [
  // DESAYUNOS

  {
    id: 'recipe-breakfast-rice-cream-berries',
    name: 'Crema de arroz con frutos del bosque',
    category: 'breakfast',
    calories: 610,
    protein: 34,
    carbs: 88,
    fat: 14,
    ingredients: [
      {
        ingredientId: 'ing-rice-cream',
        quantity: 80,
        unit: 'g',
      },
      {
        ingredientId: 'ing-milk',
        quantity: 250,
        unit: 'ml',
        notes: 'Semidesnatada',
      },
      {
        ingredientId: 'ing-whey',
        quantity: 25,
        unit: 'g',
      },
      {
        ingredientId: 'ing-berries',
        quantity: 100,
        unit: 'g',
      },
      {
        ingredientId: 'ing-peanut-butter',
        quantity: 10,
        unit: 'g',
      },
    ],
  },
  {
    id: 'recipe-breakfast-yogurt-oats-berries',
    name: 'Yogur griego con avena en polvo y frutos del bosque',
    category: 'breakfast',
    calories: 650,
    protein: 33,
    carbs: 82,
    fat: 21,
    ingredients: [
      {
        ingredientId: 'ing-greek-yogurt',
        quantity: 250,
        unit: 'g',
      },
      {
        ingredientId: 'ing-oat-powder',
        quantity: 70,
        unit: 'g',
      },
      {
        ingredientId: 'ing-berries',
        quantity: 100,
        unit: 'g',
      },
      {
        ingredientId: 'ing-honey',
        quantity: 15,
        unit: 'g',
      },
      {
        ingredientId: 'ing-walnuts',
        quantity: 15,
        unit: 'g',
      },
    ],
  },
  {
    id: 'recipe-breakfast-toast-cream-cheese-jam',
    name: 'Tostadas con queso crema y mermelada',
    category: 'breakfast',
    calories: 620,
    protein: 31,
    carbs: 92,
    fat: 15,
    ingredients: [
      {
        ingredientId: 'ing-bread',
        quantity: 120,
        unit: 'g',
      },
      {
        ingredientId: 'ing-cream-cheese',
        quantity: 60,
        unit: 'g',
      },
      {
        ingredientId: 'ing-jam',
        quantity: 35,
        unit: 'g',
      },
      {
        ingredientId: 'ing-whey',
        quantity: 25,
        unit: 'g',
        notes: 'Con agua',
      },
    ],
  },
  {
    id: 'recipe-breakfast-toast-cream-cheese-turkey',
    name: 'Tostadas con queso crema y pavo',
    category: 'breakfast',
    calories: 610,
    protein: 39,
    carbs: 65,
    fat: 21,
    ingredients: [
      {
        ingredientId: 'ing-bread',
        quantity: 120,
        unit: 'g',
      },
      {
        ingredientId: 'ing-cream-cheese',
        quantity: 50,
        unit: 'g',
      },
      {
        ingredientId: 'ing-turkey',
        quantity: 100,
        unit: 'g',
      },
      {
        ingredientId: 'ing-olive-oil',
        quantity: 10,
        unit: 'g',
      },
    ],
  },
  {
    id: 'recipe-breakfast-rice-cakes-peanut-butter',
    name: 'Tortitas de arroz con crema de cacahuete',
    category: 'breakfast',
    calories: 670,
    protein: 34,
    carbs: 82,
    fat: 24,
    ingredients: [
      {
        ingredientId: 'ing-rice-cakes',
        quantity: 6,
        unit: 'ud',
      },
      {
        ingredientId: 'ing-peanut-butter',
        quantity: 45,
        unit: 'g',
      },
      {
        ingredientId: 'ing-banana',
        quantity: 1,
        unit: 'ud',
      },
      {
        ingredientId: 'ing-whey',
        quantity: 25,
        unit: 'g',
        notes: 'Con agua',
      },
    ],
  },
  {
    id: 'recipe-breakfast-eggs-tuna-mayo',
    name: 'Huevos cocidos con atún y mayonesa',
    category: 'breakfast',
    calories: 650,
    protein: 43,
    carbs: 45,
    fat: 32,
    ingredients: [
      {
        ingredientId: 'ing-eggs',
        quantity: 3,
        unit: 'ud',
      },
      {
        ingredientId: 'ing-tuna',
        quantity: 100,
        unit: 'g',
        preparationState: 'drained',
      },
      {
        ingredientId: 'ing-light-mayo',
        quantity: 35,
        unit: 'g',
      },
      {
        ingredientId: 'ing-bread',
        quantity: 80,
        unit: 'g',
      },
      {
        ingredientId: 'ing-olive-oil',
        quantity: 5,
        unit: 'g',
      },
    ],
  },

  // PRE-ENTRENO

  {
    id: 'recipe-preworkout-banana-gainer',
    name: 'Plátano + mass gainer',
    category: 'preworkout',
    calories: 300,
    protein: 11,
    carbs: 62,
    fat: 2,
    ingredients: [
      {
        ingredientId: 'ing-banana',
        quantity: 1,
        unit: 'ud',
      },
      {
        ingredientId: 'ing-mass-gainer',
        quantity: 0.5,
        unit: 'ración',
      },
      {
        ingredientId: 'ing-water',
        quantity: null,
        unit: null,
      },
    ],
  },
  {
    id: 'recipe-preworkout-dates-gainer',
    name: 'Dátiles + mass gainer',
    category: 'preworkout',
    calories: 370,
    protein: 12,
    carbs: 83,
    fat: 2,
    ingredients: [
      {
        ingredientId: 'ing-dates',
        quantity: 3,
        unit: 'ud',
      },
      {
        ingredientId: 'ing-mass-gainer',
        quantity: 0.5,
        unit: 'ración',
      },
      {
        ingredientId: 'ing-water',
        quantity: null,
        unit: null,
      },
    ],
  },
  {
    id: 'recipe-preworkout-rice-cakes-honey',
    name: 'Tortitas de arroz + miel',
    category: 'preworkout',
    calories: 160,
    protein: 2,
    carbs: 38,
    fat: 1,
    ingredients: [
      {
        ingredientId: 'ing-rice-cakes',
        quantity: 2,
        quantityMax: 3,
        unit: 'ud',
      },
      {
        ingredientId: 'ing-honey',
        quantity: 15,
        quantityMax: 20,
        unit: 'g',
      },
      {
        ingredientId: 'ing-water',
        quantity: null,
        unit: null,
      },
    ],
  },
  {
    id: 'recipe-preworkout-bread-jam',
    name: 'Pan + mermelada',
    category: 'preworkout',
    calories: 165,
    protein: 4,
    carbs: 35,
    fat: 1,
    ingredients: [
      {
        ingredientId: 'ing-bread',
        quantity: 40,
        quantityMax: 50,
        unit: 'g',
      },
      {
        ingredientId: 'ing-jam',
        quantity: 20,
        unit: 'g',
      },
      {
        ingredientId: 'ing-water',
        quantity: null,
        unit: null,
      },
    ],
  },
  {
    id: 'recipe-preworkout-banana-protein-yogurt',
    name: 'Plátano + yogur líquido',
    category: 'preworkout',
    calories: 240,
    protein: 16,
    carbs: 42,
    fat: 2,
    ingredients: [
      {
        ingredientId: 'ing-banana',
        quantity: 1,
        unit: 'ud',
      },
      {
        ingredientId: 'ing-protein-yogurt-drink',
        quantity: 1,
        unit: 'ud',
      },
    ],
  },
  {
    id: 'recipe-preworkout-homemade-shake',
    name: 'Batido casero pre-entreno',
    category: 'preworkout',
    calories: 360,
    protein: 30,
    carbs: 58,
    fat: 5,
    ingredients: [
      {
        ingredientId: 'ing-milk',
        quantity: 200,
        unit: 'ml',
      },
      {
        ingredientId: 'ing-banana',
        quantity: 0.5,
        unit: 'ud',
      },
      {
        ingredientId: 'ing-dates',
        quantity: 2,
        unit: 'ud',
      },
      {
        ingredientId: 'ing-whey',
        quantity: 20,
        quantityMax: 25,
        unit: 'g',
      },
    ],
  },

  // SNACK TRABAJO

  {
    id: 'recipe-work-snack-rice-cakes',
    name: 'Tortitas de arroz',
    category: 'work_snack',
    calories: 290,
    protein: 8,
    carbs: 38,
    fat: 12,
    ingredients: [
      {
        ingredientId: 'ing-rice-cakes',
        quantity: 5,
        unit: 'ud',
      },
      {
        ingredientId: 'ing-peanut-butter',
        quantity: 20,
        unit: 'g',
      },
    ],
  },
  {
    id: 'recipe-work-snack-seed-bread-turkey',
    name: 'Pan de pipas con pavo',
    category: 'work_snack',
    calories: 390,
    protein: 20,
    carbs: 42,
    fat: 16,
    ingredients: [
      {
        ingredientId: 'ing-seed-bread',
        quantity: 80,
        unit: 'g',
      },
      {
        ingredientId: 'ing-turkey',
        quantity: 60,
        unit: 'g',
      },
    ],
  },
  {
    id: 'recipe-work-snack-dates-almonds',
    name: 'Dátiles con almendras',
    category: 'work_snack',
    calories: 310,
    protein: 6,
    carbs: 55,
    fat: 10,
    ingredients: [
      {
        ingredientId: 'ing-dates',
        quantity: 70,
        unit: 'g',
      },
      {
        ingredientId: 'ing-almonds',
        quantity: 20,
        unit: 'g',
      },
    ],
  },
  {
    id: 'recipe-work-snack-figs-walnuts',
    name: 'Higos secos con nueces',
    category: 'work_snack',
    calories: 360,
    protein: 6,
    carbs: 58,
    fat: 14,
    ingredients: [
      {
        ingredientId: 'ing-dried-figs',
        quantity: 80,
        unit: 'g',
      },
      {
        ingredientId: 'ing-walnuts',
        quantity: 20,
        unit: 'g',
      },
    ],
  },

  // COMIDAS PRINCIPALES

  {
    id: 'recipe-main-macaroni-chicken-gratin',
    name: 'Macarrones con pollo gratinados',
    category: 'main_meal',
    calories: 880,
    protein: 55,
    carbs: 100,
    fat: 25,
    ingredients: [
      {
        ingredientId: 'ing-macaroni',
        quantity: 120,
        unit: 'g',
        preparationState: 'dry',
      },
      {
        ingredientId: 'ing-chicken',
        quantity: 150,
        unit: 'g',
      },
      {
        ingredientId: 'ing-gratin-cheese',
        quantity: 40,
        unit: 'g',
      },
      {
        ingredientId: 'ing-tomato-sauce',
        quantity: 80,
        unit: 'g',
      },
      {
        ingredientId: 'ing-olive-oil',
        quantity: 10,
        unit: 'g',
      },
    ],
  },
  {
    id: 'recipe-main-macaroni-ground-meat',
    name: 'Macarrones con carne picada',
    category: 'main_meal',
    calories: 850,
    protein: 45,
    carbs: 100,
    fat: 28,
    ingredients: [
      {
        ingredientId: 'ing-macaroni',
        quantity: 120,
        unit: 'g',
        preparationState: 'dry',
      },
      {
        ingredientId: 'ing-ground-meat',
        quantity: 150,
        unit: 'g',
      },
      {
        ingredientId: 'ing-tomato-sauce',
        quantity: 100,
        unit: 'g',
      },
      {
        ingredientId: 'ing-olive-oil',
        quantity: 10,
        unit: 'g',
      },
    ],
  },
  {
    id: 'recipe-main-pasta-tuna-salad',
    name: 'Ensalada de pasta con atún',
    category: 'main_meal',
    calories: 820,
    protein: 45,
    carbs: 105,
    fat: 24,
    ingredients: [
      {
        ingredientId: 'ing-pasta',
        quantity: 120,
        unit: 'g',
        preparationState: 'dry',
      },
      {
        ingredientId: 'ing-tuna',
        quantity: 120,
        unit: 'g',
      },
      {
        ingredientId: 'ing-corn',
        quantity: 60,
        unit: 'g',
      },
      {
        ingredientId: 'ing-olive-oil',
        quantity: 15,
        unit: 'g',
      },
      {
        ingredientId: 'ing-vegetables',
        quantity: 100,
        unit: 'g',
      },
    ],
  },
  {
    id: 'recipe-main-pasta-chicken-salad',
    name: 'Ensalada de pasta con pollo',
    category: 'main_meal',
    calories: 840,
    protein: 52,
    carbs: 105,
    fat: 23,
    ingredients: [
      {
        ingredientId: 'ing-pasta',
        quantity: 120,
        unit: 'g',
        preparationState: 'dry',
      },
      {
        ingredientId: 'ing-chicken',
        quantity: 150,
        unit: 'g',
      },
      {
        ingredientId: 'ing-olive-oil',
        quantity: 15,
        unit: 'g',
      },
      {
        ingredientId: 'ing-corn',
        quantity: 50,
        unit: 'g',
      },
      {
        ingredientId: 'ing-vegetables',
        quantity: 100,
        unit: 'g',
      },
    ],
  },
  {
    id: 'recipe-main-lentils-chicken',
    name: 'Lentejas con verduras y pollo',
    category: 'main_meal',
    calories: 820,
    protein: 55,
    carbs: 105,
    fat: 16,
    ingredients: [
      {
        ingredientId: 'ing-lentils',
        quantity: 300,
        unit: 'g',
        preparationState: 'cooked',
      },
      {
        ingredientId: 'ing-chicken',
        quantity: 150,
        unit: 'g',
      },
      {
        ingredientId: 'ing-rice',
        quantity: 120,
        unit: 'g',
        preparationState: 'cooked',
      },
      {
        ingredientId: 'ing-vegetables',
        quantity: 150,
        unit: 'g',
      },
      {
        ingredientId: 'ing-olive-oil',
        quantity: 10,
        unit: 'g',
      },
    ],
  },
  {
    id: 'recipe-main-lentils-meat',
    name: 'Lentejas con verduras y carne',
    category: 'main_meal',
    calories: 860,
    protein: 48,
    carbs: 100,
    fat: 28,
    ingredients: [
      {
        ingredientId: 'ing-lentils',
        quantity: 300,
        unit: 'g',
        preparationState: 'cooked',
      },
      {
        ingredientId: 'ing-ground-meat',
        quantity: 150,
        unit: 'g',
      },
      {
        ingredientId: 'ing-vegetables',
        quantity: 150,
        unit: 'g',
      },
      {
        ingredientId: 'ing-rice',
        quantity: 100,
        unit: 'g',
        preparationState: 'cooked',
      },
      {
        ingredientId: 'ing-olive-oil',
        quantity: 10,
        unit: 'g',
      },
    ],
  },
  {
    id: 'recipe-main-russian-salad-chicken',
    name: 'Ensaladilla rusa con pollo',
    category: 'main_meal',
    calories: 790,
    protein: 48,
    carbs: 80,
    fat: 28,
    ingredients: [
      {
        ingredientId: 'ing-potato',
        quantity: 300,
        unit: 'g',
        preparationState: 'cooked',
      },
      {
        ingredientId: 'ing-chicken',
        quantity: 150,
        unit: 'g',
      },
      {
        ingredientId: 'ing-peas-carrots',
        quantity: 120,
        unit: 'g',
      },
      {
        ingredientId: 'ing-light-mayo',
        quantity: 40,
        unit: 'g',
      },
      {
        ingredientId: 'ing-olive-oil',
        quantity: 10,
        unit: 'g',
      },
    ],
  },
  {
    id: 'recipe-main-russian-salad-egg-tuna',
    name: 'Ensaladilla rusa con huevo y atún',
    category: 'main_meal',
    calories: 820,
    protein: 45,
    carbs: 78,
    fat: 34,
    ingredients: [
      {
        ingredientId: 'ing-potato',
        quantity: 300,
        unit: 'g',
        preparationState: 'cooked',
      },
      {
        ingredientId: 'ing-tuna',
        quantity: 100,
        unit: 'g',
      },
      {
        ingredientId: 'ing-eggs',
        quantity: 2,
        unit: 'ud',
      },
      {
        ingredientId: 'ing-peas-carrots',
        quantity: 120,
        unit: 'g',
      },
      {
        ingredientId: 'ing-light-mayo',
        quantity: 35,
        unit: 'g',
      },
    ],
  },
  {
    id: 'recipe-main-chickpeas-meat-sofrito-egg',
    name: 'Garbanzos con carne, sofrito y huevo',
    category: 'main_meal',
    calories: 870,
    protein: 48,
    carbs: 85,
    fat: 34,
    ingredients: [
      {
        ingredientId: 'ing-chickpeas',
        quantity: 300,
        unit: 'g',
        preparationState: 'cooked',
      },
      {
        ingredientId: 'ing-ground-meat',
        quantity: 120,
        unit: 'g',
      },
      {
        ingredientId: 'ing-eggs',
        quantity: 1,
        unit: 'ud',
      },
      {
        ingredientId: 'ing-sofrito',
        quantity: 100,
        unit: 'g',
      },
      {
        ingredientId: 'ing-olive-oil',
        quantity: 10,
        unit: 'g',
      },
    ],
  },
  {
    id: 'recipe-main-rice-chicken-sofrito',
    name: 'Arroz salteado con pollo y sofrito',
    category: 'main_meal',
    calories: 850,
    protein: 55,
    carbs: 105,
    fat: 22,
    ingredients: [
      {
        ingredientId: 'ing-rice',
        quantity: 120,
        unit: 'g',
        preparationState: 'dry',
      },
      {
        ingredientId: 'ing-chicken',
        quantity: 160,
        unit: 'g',
      },
      {
        ingredientId: 'ing-sofrito',
        quantity: 120,
        unit: 'g',
      },
      {
        ingredientId: 'ing-eggs',
        quantity: 1,
        unit: 'ud',
      },
      {
        ingredientId: 'ing-olive-oil',
        quantity: 10,
        unit: 'g',
      },
    ],
  },
  {
    id: 'recipe-main-mixed-vegetables-prawns',
    name: 'Menestra de verduras y gambas',
    category: 'main_meal',
    calories: 780,
    protein: 50,
    carbs: 92,
    fat: 20,
    ingredients: [
      {
        ingredientId: 'ing-mixed-vegetables',
        quantity: 350,
        unit: 'g',
      },
      {
        ingredientId: 'ing-prawns',
        quantity: 220,
        unit: 'g',
        notes: 'Peladas',
      },
      {
        ingredientId: 'ing-rice',
        quantity: 180,
        unit: 'g',
        preparationState: 'cooked',
      },
      {
        ingredientId: 'ing-olive-oil',
        quantity: 15,
        unit: 'g',
      },
      {
        ingredientId: 'ing-bread',
        quantity: 60,
        unit: 'g',
      },
    ],
  },

  // ANTES DE DORMIR

  {
    id: 'recipe-bedtime-yogurt-oats-berries',
    name: 'Yogur griego con avena y frutos del bosque',
    category: 'bedtime',
    calories: 390,
    protein: 24,
    carbs: 52,
    fat: 9,
    ingredients: [
      {
        ingredientId: 'ing-greek-yogurt',
        quantity: 200,
        unit: 'g',
      },
      {
        ingredientId: 'ing-oat-powder',
        quantity: 35,
        unit: 'g',
      },
      {
        ingredientId: 'ing-berries',
        quantity: 80,
        unit: 'g',
      },
      {
        ingredientId: 'ing-honey',
        quantity: 10,
        unit: 'g',
      },
    ],
  },
  {
    id: 'recipe-bedtime-toast-cream-cheese',
    name: 'Tostadas con queso crema',
    category: 'bedtime',
    calories: 420,
    protein: 24,
    carbs: 42,
    fat: 17,
    ingredients: [
      {
        ingredientId: 'ing-bread',
        quantity: 70,
        unit: 'g',
      },
      {
        ingredientId: 'ing-cream-cheese',
        quantity: 50,
        unit: 'g',
      },
      {
        ingredientId: 'ing-turkey',
        quantity: 60,
        unit: 'g',
      },
    ],
  },
  {
    id: 'recipe-bedtime-toast-cream-cheese-turkey',
    name: 'Tostadas con queso crema y pavo',
    category: 'bedtime',
    calories: 410,
    protein: 30,
    carbs: 40,
    fat: 13,
    ingredients: [
      {
        ingredientId: 'ing-bread',
        quantity: 70,
        unit: 'g',
      },
      {
        ingredientId: 'ing-cream-cheese',
        quantity: 40,
        unit: 'g',
      },
      {
        ingredientId: 'ing-turkey',
        quantity: 90,
        unit: 'g',
      },
    ],
  },
  {
    id: 'recipe-bedtime-rice-cakes-peanut-butter',
    name: 'Tortitas de arroz con crema de cacahuete',
    category: 'bedtime',
    calories: 390,
    protein: 25,
    carbs: 42,
    fat: 14,
    ingredients: [
      {
        ingredientId: 'ing-rice-cakes',
        quantity: 4,
        unit: 'ud',
      },
      {
        ingredientId: 'ing-peanut-butter',
        quantity: 25,
        unit: 'g',
      },
      {
        ingredientId: 'ing-whey',
        quantity: 20,
        unit: 'g',
        notes: 'Con agua',
      },
    ],
  },
  {
    id: 'recipe-bedtime-dates-yogurt',
    name: 'Dátiles con yogur griego',
    category: 'bedtime',
    calories: 330,
    protein: 20,
    carbs: 52,
    fat: 5,
    ingredients: [
      {
        ingredientId: 'ing-dates',
        quantity: 60,
        unit: 'g',
      },
      {
        ingredientId: 'ing-greek-yogurt',
        quantity: 170,
        unit: 'g',
      },
    ],
  },
  {
    id: 'recipe-bedtime-figs-yogurt-walnuts',
    name: 'Higos secos con yogur y nueces',
    category: 'bedtime',
    calories: 360,
    protein: 21,
    carbs: 45,
    fat: 10,
    ingredients: [
      {
        ingredientId: 'ing-dried-figs',
        quantity: 60,
        unit: 'g',
      },
      {
        ingredientId: 'ing-greek-yogurt',
        quantity: 170,
        unit: 'g',
      },
      {
        ingredientId: 'ing-walnuts',
        quantity: 10,
        unit: 'g',
      },
    ],
  },
  {
    id: 'recipe-bedtime-eggs-tuna-mayo',
    name: 'Huevos cocidos con atún y mayonesa',
    category: 'bedtime',
    calories: 440,
    protein: 34,
    carbs: 24,
    fat: 22,
    ingredients: [
      {
        ingredientId: 'ing-eggs',
        quantity: 2,
        unit: 'ud',
      },
      {
        ingredientId: 'ing-tuna',
        quantity: 80,
        unit: 'g',
      },
      {
        ingredientId: 'ing-light-mayo',
        quantity: 20,
        unit: 'g',
      },
      {
        ingredientId: 'ing-bread',
        quantity: 40,
        unit: 'g',
      },
    ],
  },

  // BATIDOS

  {
    id: 'recipe-shake-protein',
    name: 'Batido de proteína',
    category: 'shake',
    calories: 430,
    protein: 35,
    carbs: 52,
    fat: 8,
    ingredients: [
      {
        ingredientId: 'ing-whey',
        quantity: 30,
        unit: 'g',
      },
      {
        ingredientId: 'ing-milk',
        quantity: 300,
        unit: 'ml',
        notes: 'Semidesnatada',
      },
      {
        ingredientId: 'ing-banana',
        quantity: 1,
        unit: 'ud',
      },
    ],
  },
  {
    id: 'recipe-shake-banana-protein',
    name: 'Batido de plátano y proteína',
    category: 'shake',
    calories: 540,
    protein: 39,
    carbs: 72,
    fat: 11,
    ingredients: [
      {
        ingredientId: 'ing-whey',
        quantity: 30,
        unit: 'g',
      },
      {
        ingredientId: 'ing-milk',
        quantity: 300,
        unit: 'ml',
      },
      {
        ingredientId: 'ing-banana',
        quantity: 1,
        unit: 'ud',
      },
      {
        ingredientId: 'ing-oats',
        quantity: 30,
        unit: 'g',
      },
    ],
  },
  {
    id: 'recipe-shake-berries-yogurt',
    name: 'Batido de frutos del bosque y yogur',
    category: 'shake',
    calories: 430,
    protein: 39,
    carbs: 45,
    fat: 8,
    ingredients: [
      {
        ingredientId: 'ing-greek-yogurt',
        quantity: 250,
        unit: 'g',
      },
      {
        ingredientId: 'ing-berries',
        quantity: 150,
        unit: 'g',
      },
      {
        ingredientId: 'ing-whey',
        quantity: 20,
        unit: 'g',
      },
      {
        ingredientId: 'ing-honey',
        quantity: 15,
        unit: 'g',
      },
    ],
  },
  {
    id: 'recipe-shake-oats',
    name: 'Batido de avena',
    category: 'shake',
    calories: 620,
    protein: 42,
    carbs: 82,
    fat: 13,
    ingredients: [
      {
        ingredientId: 'ing-oats',
        quantity: 80,
        unit: 'g',
      },
      {
        ingredientId: 'ing-whey',
        quantity: 30,
        unit: 'g',
      },
      {
        ingredientId: 'ing-milk',
        quantity: 300,
        unit: 'ml',
      },
      {
        ingredientId: 'ing-honey',
        quantity: 15,
        unit: 'g',
      },
    ],
  },
  {
    id: 'recipe-shake-rice-cream',
    name: 'Batido de crema de arroz',
    category: 'shake',
    calories: 610,
    protein: 41,
    carbs: 85,
    fat: 10,
    ingredients: [
      {
        ingredientId: 'ing-rice-cream',
        quantity: 80,
        unit: 'g',
      },
      {
        ingredientId: 'ing-whey',
        quantity: 30,
        unit: 'g',
      },
      {
        ingredientId: 'ing-milk',
        quantity: 300,
        unit: 'ml',
      },
      {
        ingredientId: 'ing-cocoa',
        quantity: 10,
        unit: 'g',
      },
    ],
  },
  {
    id: 'recipe-shake-peanut-butter',
    name: 'Batido de crema de cacahuete',
    category: 'shake',
    calories: 650,
    protein: 43,
    carbs: 58,
    fat: 27,
    ingredients: [
      {
        ingredientId: 'ing-whey',
        quantity: 30,
        unit: 'g',
      },
      {
        ingredientId: 'ing-milk',
        quantity: 300,
        unit: 'ml',
      },
      {
        ingredientId: 'ing-peanut-butter',
        quantity: 35,
        unit: 'g',
      },
      {
        ingredientId: 'ing-banana',
        quantity: 1,
        unit: 'ud',
      },
    ],
  },
  {
    id: 'recipe-shake-high-calorie',
    name: 'Batido hipercalórico',
    category: 'shake',
    calories: 950,
    protein: 50,
    carbs: 115,
    fat: 32,
    ingredients: [
      {
        ingredientId: 'ing-milk',
        quantity: 400,
        unit: 'ml',
        notes: 'Entera',
      },
      {
        ingredientId: 'ing-oats',
        quantity: 90,
        unit: 'g',
      },
      {
        ingredientId: 'ing-whey',
        quantity: 30,
        unit: 'g',
      },
      {
        ingredientId: 'ing-peanut-butter',
        quantity: 40,
        unit: 'g',
      },
      {
        ingredientId: 'ing-banana',
        quantity: 1,
        unit: 'ud',
      },
      {
        ingredientId: 'ing-honey',
        quantity: 20,
        unit: 'g',
      },
    ],
  },
  {
    id: 'recipe-shake-post-workout',
    name: 'Batido post-entreno',
    category: 'shake',
    calories: 670,
    protein: 42,
    carbs: 100,
    fat: 9,
    ingredients: [
      {
        ingredientId: 'ing-whey',
        quantity: 30,
        unit: 'g',
      },
      {
        ingredientId: 'ing-rice-cream',
        quantity: 70,
        unit: 'g',
      },
      {
        ingredientId: 'ing-milk',
        quantity: 300,
        unit: 'ml',
      },
      {
        ingredientId: 'ing-banana',
        quantity: 1,
        unit: 'ud',
      },
    ],
  },
  {
    id: 'recipe-shake-cocoa',
    name: 'Batido de cacao',
    category: 'shake',
    calories: 570,
    protein: 42,
    carbs: 65,
    fat: 14,
    ingredients: [
      {
        ingredientId: 'ing-whey',
        quantity: 30,
        unit: 'g',
      },
      {
        ingredientId: 'ing-milk',
        quantity: 300,
        unit: 'ml',
      },
      {
        ingredientId: 'ing-cocoa',
        quantity: 15,
        unit: 'g',
      },
      {
        ingredientId: 'ing-oats',
        quantity: 50,
        unit: 'g',
      },
      {
        ingredientId: 'ing-honey',
        quantity: 10,
        unit: 'g',
      },
    ],
  },
  {
    id: 'recipe-shake-tropical',
    name: 'Batido tropical',
    category: 'shake',
    calories: 610,
    protein: 37,
    carbs: 92,
    fat: 10,
    ingredients: [
      {
        ingredientId: 'ing-whey',
        quantity: 25,
        unit: 'g',
      },
      {
        ingredientId: 'ing-milk',
        quantity: 300,
        unit: 'ml',
      },
      {
        ingredientId: 'ing-mango',
        quantity: 150,
        unit: 'g',
      },
      {
        ingredientId: 'ing-banana',
        quantity: 1,
        unit: 'ud',
      },
      {
        ingredientId: 'ing-oats',
        quantity: 40,
        unit: 'g',
      },
    ],
  },
]

const ingredients: Ingredient[] =
  ingredientDefinitions.map((ingredient) => ({
    ...base(ingredient.id),
    name: ingredient.name,
    category: ingredient.category,
    defaultUnit: ingredient.defaultUnit,
    notes: ingredient.notes ?? null,
  }))

const recipes: Recipe[] =
  recipeDefinitions.map((recipe) => ({
    ...base(recipe.id),
    name: recipe.name,
    category: recipe.category,
    instructions: recipe.instructions ?? null,
    estimatedCalories: recipe.calories,
    estimatedProtein: recipe.protein,
    estimatedCarbs: recipe.carbs,
    estimatedFat: recipe.fat,
    isFavorite: false,
    notes: recipe.notes ?? null,
  }))

const recipeIngredients: RecipeIngredient[] =
  recipeDefinitions.flatMap((recipe) =>
    recipe.ingredients.map((item, index) => ({
      ...base(
        `ri-${recipe.id}-${String(index + 1).padStart(2, '0')}`,
      ),
      recipeId: recipe.id,
      ingredientId: item.ingredientId,
      order: index + 1,
      quantity: item.quantity,
      quantityMax: item.quantityMax ?? null,
      unit: item.unit,
      preparationState:
        item.preparationState ?? null,
      notes: item.notes ?? null,
    })),
  )

export async function ensureNutritionSeed() {
  const existingSeed =
    await db.appMeta.get('nutritionSeedVersion')

  if (existingSeed?.value === nutritionSeedVersion) {
    return
  }

  await db.transaction(
    'rw',
    db.ingredients,
    db.recipes,
    db.recipeIngredients,
    db.appMeta,
    async () => {
      // Seed ownership v2.1: seed only fills identities that have never existed.
      // Existing active, edited or soft-deleted user entities are never overwritten
      // or resurrected when seed metadata is missing/replayed.
      const [currentIngredients, currentRecipes, currentRelations] = await Promise.all([
        db.ingredients.bulkGet(ingredients.map((item) => item.id)),
        db.recipes.bulkGet(recipes.map((item) => item.id)),
        db.recipeIngredients.bulkGet(recipeIngredients.map((item) => item.id)),
      ])

      const missingIngredients = ingredients.filter((_, index) => currentIngredients[index] === undefined)
      const missingRecipes = recipes.filter((_, index) => currentRecipes[index] === undefined)
      const missingRelations = recipeIngredients.filter((_, index) => currentRelations[index] === undefined)

      if (missingIngredients.length > 0) await db.ingredients.bulkAdd(missingIngredients)
      if (missingRecipes.length > 0) await db.recipes.bulkAdd(missingRecipes)
      if (missingRelations.length > 0) await db.recipeIngredients.bulkAdd(missingRelations)

      await db.appMeta.put({
        key: 'nutritionSeedVersion',
        value: nutritionSeedVersion,
        updatedAt: new Date().toISOString(),
      })
    },
  )
}