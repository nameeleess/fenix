import assert from 'node:assert/strict'
import fs from 'node:fs'
import crypto from 'node:crypto'

const service=fs.readFileSync('src/features/nutrition/nutritionService.ts','utf8')
function region(start,end){const a=service.indexOf(start);assert.ok(a>=0,`${start} missing`);const b=service.indexOf(end,a+1);return service.slice(a,b<0?service.length:b)}

const create=region('export async function createCatalogIngredient','export async function updateCatalogIngredient')
assert.ok(create.includes('db.transaction'));assert.ok(create.indexOf('findActiveIngredientByName')>create.indexOf('db.transaction'))
const update=region('export async function updateCatalogIngredient','export async function deleteCatalogIngredient')
assert.ok(update.includes('db.transaction'));assert.ok(update.indexOf('db.ingredients.get')>update.indexOf('db.transaction'));assert.ok(update.includes('existing.version + 1'))
const del=region('export async function deleteCatalogIngredient','function combineQuantities')
for(const t of ['db.ingredients','db.recipeIngredients','db.recipes','db.shoppingItems','ingredient.version + 1','publishCommittedMutation'])assert.ok(del.includes(t),`delete invariant ${t}`)
assert.ok(del.indexOf('db.ingredients.get')>del.indexOf('db.transaction'));assert.ok(del.indexOf(".where('ingredientId')")>del.indexOf('db.transaction'))
const helper=region('async function addIngredientToBasketInTransaction','export async function addRecipeIngredientToBasket')
for(const t of ['db.ingredients.get','db.shoppingItems','existing.version + 1','normalizeUnit'])assert.ok(helper.includes(t),`basket helper ${t}`)
const rel=region('export async function addRecipeIngredientToBasket','export async function addCatalogIngredientToBasket')
for(const t of ['db.recipes','db.recipeIngredients','db.ingredients','db.shoppingItems','db.recipeIngredients.get','db.recipes.get','addIngredientToBasketInTransaction'])assert.ok(rel.includes(t),`relation basket ${t}`)
for(const [s,e] of [['export async function updateShoppingItem','export async function toggleShoppingItemChecked'],['export async function toggleShoppingItemChecked','export async function removeShoppingItem'],['export async function removeShoppingItem','export async function clearCheckedShoppingItems']]){const r=region(s,e);assert.ok(r.includes('db.transaction'));assert.ok(r.includes('db.shoppingItems.get'));assert.ok(r.includes('version: item.version + 1'))}
const clear=region('export async function clearCheckedShoppingItems','__EOF__');assert.ok(clear.includes('db.transaction'));assert.ok(clear.indexOf('db.shoppingItems.toArray')>clear.indexOf('db.transaction'))

const db=fs.readFileSync('src/db/database.ts','utf8');assert.ok(db.includes('export const CURRENT_SCHEMA_VERSION = 5'));assert.ok(!db.includes('this.version(6)'))
const expected = {
  'src/db/database.ts': 'efff63a6c4f1f641ee9283d10d4dabaedabd269ff15515592b688ec6a580e677',
}
for (const [f, h] of Object.entries(expected)) {
  const actual = crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')
  assert.equal(actual, h, `${f} changed`)
}

console.log('F2-RC2.1 source invariants: PASS (Ingredient/RecipeIngredient/Recipe/Shopping lifecycle transactions + schema5 preserved)')
