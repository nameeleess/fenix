import assert from 'node:assert/strict'
import fs from 'node:fs'
import {
  SCHEMA_5_TABLES,
  validateFenixBackup,
} from '../src/services/backupIntegrity.ts'
import {
  normalizeIngredientName,
  normalizeShoppingUnit,
} from '../src/features/nutrition/nutritionLibraryIdentity.ts'

function recount(backup) {
  backup.tableCounts = Object.fromEntries(
    SCHEMA_5_TABLES.map((name) => [name, backup.tables[name].length]),
  )
  backup.totalRecords = Object.values(backup.tableCounts).reduce((sum, count) => sum + count, 0)
  return backup
}

function baseBackup() {
  const tables = Object.fromEntries(SCHEMA_5_TABLES.map((name) => [name, []]))
  tables.appMeta = [{ key: 'schemaVersion', value: '5', updatedAt: 't' }]
  return recount({
    format: 'fenix-backup',
    formatVersion: 1,
    exportedAt: '2026-09-07T00:00:00.000Z',
    databaseName: 'fenix-db',
    schemaVersion: '5',
    totalRecords: 0,
    tableCounts: {},
    tables,
  })
}

function ingredient(id, name, deletedAt = null) {
  return { id, name, category: 'other', defaultUnit: null, notes: null, createdAt: 't', updatedAt: 't', deletedAt, version: 1 }
}

function shopping(id, ingredientId, unit, deletedAt = null) {
  return { id, ingredientId, quantity: 1, quantityMax: null, unit, checked: false, addedAt: 't', createdAt: 't', updatedAt: 't', deletedAt, version: 1 }
}

function valid(backup, label) {
  const result = validateFenixBackup(recount(backup))
  assert.equal(result.valid, true, `${label}: ${result.errors.join(' | ')}`)
}

function invalid(backup, label) {
  const result = validateFenixBackup(recount(backup))
  assert.equal(result.valid, false, `${label}: expected REJECT`)
  return result
}

// Policy parity itself.
assert.equal(normalizeIngredientName(' Arroz '), 'arroz')
assert.equal(normalizeIngredientName('ARROZ'), 'arroz')
assert.equal(normalizeShoppingUnit(' kg '), 'kg')
assert.equal(normalizeShoppingUnit('   '), null)
assert.equal(normalizeShoppingUnit(null), null)
assert.equal(normalizeShoppingUnit('KG'), 'KG')

// Q01 active Ingredient Arroz/arroz -> REJECT.
{
  const b = baseBackup()
  b.tables.ingredients = [ingredient('i1', 'Arroz'), ingredient('i2', 'arroz')]
  invalid(b, 'Q01')
}

// Q02 active Ingredient Arroz/ARROZ -> REJECT.
{
  const b = baseBackup()
  b.tables.ingredients = [ingredient('i1', 'Arroz'), ingredient('i2', 'ARROZ')]
  invalid(b, 'Q02')
}

// Q03 active + equivalent soft-deleted Ingredient -> ACCEPT.
{
  const b = baseBackup()
  b.tables.ingredients = [ingredient('i1', 'Arroz'), ingredient('i2', ' arroz ', 'deleted')]
  valid(b, 'Q03')
}

// Q04 genuinely different Ingredient names -> ACCEPT.
{
  const b = baseBackup()
  b.tables.ingredients = [ingredient('i1', 'Arroz'), ingredient('i2', 'Pasta')]
  valid(b, 'Q04')
}

// Q05 same Ingredient + kg/kg -> REJECT.
{
  const b = baseBackup()
  b.tables.ingredients = [ingredient('i1', 'Arroz')]
  b.tables.shoppingItems = [shopping('s1', 'i1', 'kg'), shopping('s2', 'i1', 'kg')]
  invalid(b, 'Q05')
}

// Q06 same Ingredient + null/whitespace -> REJECT.
{
  const b = baseBackup()
  b.tables.ingredients = [ingredient('i1', 'Arroz')]
  b.tables.shoppingItems = [shopping('s1', 'i1', null), shopping('s2', 'i1', '   ')]
  invalid(b, 'Q06')
}

// Q07 equivalent Shopping identity where one is soft-deleted -> ACCEPT.
{
  const b = baseBackup()
  b.tables.ingredients = [ingredient('i1', 'Arroz')]
  b.tables.shoppingItems = [shopping('s1', 'i1', 'kg'), shopping('s2', 'i1', ' kg ', 'deleted')]
  valid(b, 'Q07')
}

// Q08 same unit but different Ingredients -> ACCEPT.
{
  const b = baseBackup()
  b.tables.ingredients = [ingredient('i1', 'Arroz'), ingredient('i2', 'Pasta')]
  b.tables.shoppingItems = [shopping('s1', 'i1', 'kg'), shopping('s2', 'i2', 'kg')]
  valid(b, 'Q08')
}

// Q09 unit case semantics are preserved: kg != KG.
{
  const b = baseBackup()
  b.tables.ingredients = [ingredient('i1', 'Arroz')]
  b.tables.shoppingItems = [shopping('s1', 'i1', 'kg'), shopping('s2', 'i1', 'KG')]
  valid(b, 'Q09')
}

// Q10/Q11: corrupt logical duplicates fail the exact validator used by restore,
// and source ordering guarantees that this validation precedes db.open/transaction.
const backupService = fs.readFileSync('src/services/backupService.ts', 'utf8')
const restoreStart = backupService.indexOf('export async function restoreFenixBackup')
assert.ok(restoreStart >= 0, 'restore function missing')
const restoreRegion = backupService.slice(restoreStart)
const validationPos = restoreRegion.indexOf('const validation = validateFenixBackup(backup)')
const dbOpenPos = restoreRegion.indexOf('await db.open()')
const txPos = restoreRegion.indexOf("await db.transaction('rw'")
assert.ok(validationPos >= 0 && dbOpenPos > validationPos && txPos > validationPos, 'prevalidation must precede DB touch')
{
  const b = baseBackup()
  b.tables.ingredients = [ingredient('i1', 'Arroz'), ingredient('i2', ' arroz ')]
  invalid(b, 'Q10')
}
{
  const b = baseBackup()
  b.tables.ingredients = [ingredient('i1', 'Arroz')]
  b.tables.shoppingItems = [shopping('s1', 'i1', 'kg'), shopping('s2', 'i1', ' kg ')]
  invalid(b, 'Q11')
}

// Q12 official healthy baseline when supplied.
if (process.argv[2]) {
  const raw = fs.readFileSync(process.argv[2], 'utf8')
  const backup = JSON.parse(raw)
  const result = validateFenixBackup(backup)
  assert.equal(result.valid, true, `Q12 baseline invalid: ${result.errors.join(' | ')}`)
  assert.equal(backup.totalRecords, 759, 'Q12 record count')
  console.log('Q12 official baseline: PASS (759 records)')
} else {
  console.log('Q12 official baseline: deferred to path-based final gate')
}

console.log('F2-RC2.2 Backup/runtime logical identity alignment: PASS (Q01-Q11 + Q12 when baseline path supplied)')
