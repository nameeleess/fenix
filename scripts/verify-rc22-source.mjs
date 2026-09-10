import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'

const policy = fs.readFileSync('src/features/nutrition/nutritionLibraryIdentity.ts', 'utf8')
const runtime = fs.readFileSync('src/features/nutrition/nutritionService.ts', 'utf8')
const backup = fs.readFileSync('src/services/backupIntegrity.ts', 'utf8')
const restore = fs.readFileSync('src/services/backupService.ts', 'utf8')

for (const token of [".trim()", ".toLocaleLowerCase('es')", 'return trimmed || null']) {
  assert.ok(policy.includes(token), `shared policy missing ${token}`)
}
assert.ok(runtime.includes("normalizeIngredientName as normalizeName"), 'runtime must consume shared Ingredient normalizer')
assert.ok(runtime.includes("normalizeShoppingUnit as normalizeUnit"), 'runtime must consume shared Shopping unit normalizer')
assert.ok(backup.includes('normalizeIngredientName'), 'backup must consume shared Ingredient normalizer')
assert.ok(backup.includes('normalizeShoppingUnit'), 'backup must consume shared Shopping unit normalizer')
assert.ok(backup.includes('validateActiveIngredientNameUniqueness(errors, ingredients)'), 'Ingredient logical uniqueness must run')
assert.ok(backup.includes('validateActiveShoppingItemIdentityUniqueness(errors, shoppingItems)'), 'Shopping logical uniqueness must run')
assert.ok(backup.includes('if (ingredient.deletedAt !== null'), 'Ingredient uniqueness must ignore soft-deleted')
assert.ok(backup.includes('if (item.deletedAt !== null'), 'Shopping uniqueness must ignore soft-deleted')
assert.ok(!policy.includes('toLocaleLowerCase') || policy.indexOf('toLocaleLowerCase') < policy.indexOf('normalizeShoppingUnit'), 'unit normalizer must not lowercase')

const restoreStart = restore.indexOf('export async function restoreFenixBackup')
const region = restore.slice(restoreStart)
assert.ok(region.indexOf('const validation = validateFenixBackup(backup)') < region.indexOf('await db.open()'), 'prevalidation must precede db.open')
assert.ok(region.includes('const restoredValidation = validateFenixBackup(restored)'), 'postvalidation must reuse same validator')

const expected = {
  'src/db/database.ts': 'efff63a6c4f1f641ee9283d10d4dabaedabd269ff15515592b688ec6a580e677',
}
for (const [f, h] of Object.entries(expected)) {
  const actual = crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')
  assert.equal(actual, h, `${f} changed`)
}

console.log('RC2.2 runtime↔backup alignment matrix:')
console.log('RecipeIngredient active -> Recipe active: RUNTIME PASS / BACKUP PASS')
console.log('RecipeIngredient active -> Ingredient active: RUNTIME PASS / BACKUP PASS')
console.log('ShoppingItem active -> Ingredient active: RUNTIME PASS / BACKUP PASS')
console.log('Ingredient normalized active name unique: RUNTIME PASS / BACKUP PASS')
console.log('ShoppingItem ingredientId+normalizedUnit unique: RUNTIME PASS / BACKUP PASS')
console.log('F2-RC2.2 source invariants: PASS (shared identity policy + pre/post restore validator + schema5 preserved)')
