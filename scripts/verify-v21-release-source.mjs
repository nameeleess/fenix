import assert from 'node:assert/strict'
import fs from 'node:fs'

const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const lock = JSON.parse(fs.readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'))
const database = fs.readFileSync(new URL('../src/db/database.ts', import.meta.url), 'utf8')
const app = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
const vite = fs.readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8')
const pwa = fs.readFileSync(new URL('../src/pwa.ts', import.meta.url), 'utf8')
const mutationMap = fs.readFileSync(new URL('../qa/v2.1/MUTATION_MAP_v2.1.md', import.meta.url), 'utf8')
const visualMatrix = fs.readFileSync(new URL('../qa/v2.1/VISUAL_PARITY_MATRIX_v2.1.md', import.meta.url), 'utf8')
const mediaRegistry = fs.readFileSync(new URL('../qa/v2.1/MEDIA_REGISTRY_v2.1.md', import.meta.url), 'utf8')

assert.equal(pkg.version, '2.1.0-rc.1.2')
assert.equal(lock.version, '2.1.0-rc.1.2')
assert.equal(lock.packages?.['']?.version, '2.1.0-rc.1.2')
assert.equal(pkg.devDependencies?.['@repdb/exercises'], '2026.8.1')
assert.equal(lock.packages?.['node_modules/@repdb/exercises']?.version, '2026.8.1')
assert.match(database, /super\('fenix-db'\)/)
assert.match(database, /this\.version\(5\)/)
assert.doesNotMatch(database, /this\.version\(6\)/)
assert.doesNotMatch(database, /version\(6\)/)
assert.match(app, /const TrainingPage = lazy/)
assert.match(app, /const NutritionPage = lazy/)
assert.match(app, /const ProgressPage = lazy/)
assert.match(app, /const SettingsPage = lazy/)
assert.match(vite, /registerType:\s*'prompt'/)
assert.match(vite, /REPDB_PRECACHE_SOURCE_IDS/)
assert.doesNotMatch(vite, /exercise-dataset\.com/)
assert.match(pwa, /registerSW/)
assert.match(mutationMap, /duplicateWorkoutTemplate/)
assert.match(mediaRegistry, /33\/33 = 31 media licenciada del usuario \+ 1 RepDB \+ 1 FÉNIX/)
assert.match(mediaRegistry, /fallback \*\*26 RepDB \+ 7 FÉNIX/)
assert.match(mediaRegistry, /@repdb\/exercises@2026\.8\.1/)
assert.equal((visualMatrix.match(/^\| \d{2} \|/gm) ?? []).length, 26)

const forbidden = [
  /supabase/i,
  /firebase/i,
  /cloud sync/i,
]
for (const pattern of forbidden) {
  assert.doesNotMatch(`${database}\n${vite}`, pattern)
}

for (const file of [
  '../src/styles/final-v1.css',
  '../src/styles/mobile-density.css',
  '../src/styles/render-parity.css',
  '../src/styles/visual-polish.css',
]) {
  assert.equal(fs.existsSync(new URL(file, import.meta.url)), false, `${file} debe permanecer retirado`)
}

console.log('FÉNIX v2.1 release source contract: PASS (2.1.0-rc.1.2 · fenix-db/schema5 · no migration6 · package-local media · lazy PWA · 26 Golden contract)')
