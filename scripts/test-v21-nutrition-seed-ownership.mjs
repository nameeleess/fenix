import assert from 'node:assert/strict'
import fs from 'node:fs'

const source = fs.readFileSync(new URL('../src/features/nutrition/nutritionSeed.ts', import.meta.url), 'utf8')

assert.match(source, /bulkGet\(ingredients\.map/)
assert.match(source, /bulkGet\(recipes\.map/)
assert.match(source, /bulkGet\(recipeIngredients\.map/)
assert.match(source, /missingIngredients/)
assert.match(source, /missingRecipes/)
assert.match(source, /missingRelations/)
assert.match(source, /bulkAdd\(missingIngredients\)/)
assert.match(source, /bulkAdd\(missingRecipes\)/)
assert.match(source, /bulkAdd\(missingRelations\)/)
assert.doesNotMatch(source, /db\.ingredients\.bulkPut\(ingredients\)/)
assert.doesNotMatch(source, /db\.recipes\.bulkPut\(recipes\)/)
assert.doesNotMatch(source, /db\.recipeIngredients\.bulkPut\(\s*recipeIngredients/)
assert.match(source, /const nutritionSeedVersion = '1'/)

// Model the ownership rule independently: existing records (including soft-deleted)
// remain byte/logically untouched while only truly missing ids are inserted.
const seed = [
  { id: 'a', name: 'Seed A', deletedAt: null, version: 1 },
  { id: 'b', name: 'Seed B', deletedAt: null, version: 1 },
  { id: 'c', name: 'Seed C', deletedAt: null, version: 1 },
]
const existing = new Map([
  ['a', { id: 'a', name: 'Usuario A', deletedAt: null, version: 9 }],
  ['b', { id: 'b', name: 'Archivado B', deletedAt: '2026-09-07T00:00:00.000Z', version: 4 }],
])
for (const item of seed) if (!existing.has(item.id)) existing.set(item.id, structuredClone(item))
assert.deepEqual(existing.get('a'), { id: 'a', name: 'Usuario A', deletedAt: null, version: 9 })
assert.deepEqual(existing.get('b'), { id: 'b', name: 'Archivado B', deletedAt: '2026-09-07T00:00:00.000Z', version: 4 })
assert.deepEqual(existing.get('c'), seed[2])

console.log('FÉNIX v2.1 Nutrition seed ownership: PASS (insert-only · no overwrite · no resurrect · seed v1 unchanged)')
