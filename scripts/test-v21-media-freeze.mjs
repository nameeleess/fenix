import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

// Historical 26+7 is retained and verified as the technical fallback registry.
const { LEGACY_EXERCISE_MEDIA_REGISTRY: EXERCISE_MEDIA_REGISTRY } = await import('../src/features/training/media/exerciseMediaRegistry.ts')
const { REPDB_MEDIA_ITEMS, REPDB_PACKAGE_VERSION, REPDB_PRECACHE_SOURCE_IDS } = await import('./media-freeze-v21.mjs')
const seedSource = fs.readFileSync(new URL('../src/features/training/trainingSeed.ts', import.meta.url), 'utf8')
const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const vite = fs.readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8')
const sync = fs.readFileSync(new URL('./sync-repdb-media.mjs', import.meta.url), 'utf8')
const repdbPackageRoot = path.resolve('node_modules', '@repdb', 'exercises')
const repdbRuntimeRoot = path.resolve('public', 'media', 'exercises', 'repdb', REPDB_PACKAGE_VERSION)
const repdbPackageMeta = JSON.parse(fs.readFileSync(path.join(repdbPackageRoot, 'package.json'), 'utf8'))
const repdbDataset = JSON.parse(fs.readFileSync(path.join(repdbPackageRoot, 'exercises.json'), 'utf8'))
const repdbById = new Map(repdbDataset.exercises.map((item) => [item.id, item]))
const seedIds = [...new Set([...seedSource.matchAll(/\bid:\s*'(ex-[^']+)'/g)].map((match) => match[1]))].sort()
const mediaIds = EXERCISE_MEDIA_REGISTRY.map((item) => item.exerciseId).sort()

assert.equal(EXERCISE_MEDIA_REGISTRY.length, 33, 'Media Freeze debe cubrir 33 ejercicios')
assert.deepEqual(mediaIds, seedIds, 'Registry y catálogo canónico Training deben cubrir exactamente los mismos exerciseId')
assert.equal(new Set(mediaIds).size, 33)
assert.equal(new Set(EXERCISE_MEDIA_REGISTRY.map((item) => item.motionId)).size, 33)
assert.equal(EXERCISE_MEDIA_REGISTRY.filter((item) => item.source === 'repdb').length, 26)
assert.equal(EXERCISE_MEDIA_REGISTRY.filter((item) => item.source === 'fenix').length, 7)
assert.equal(REPDB_MEDIA_ITEMS.length, 26)
assert.equal(new Set(REPDB_MEDIA_ITEMS.map((item) => item.exerciseId)).size, 26)
assert.equal(pkg.devDependencies?.['@repdb/exercises'], REPDB_PACKAGE_VERSION)
assert.equal(REPDB_PACKAGE_VERSION, '2026.8.1')
assert.equal(repdbPackageMeta.version, REPDB_PACKAGE_VERSION)
assert.equal(new Set(REPDB_MEDIA_ITEMS.map((item) => item.sourceId)).size, 26, 'Los 26 mappings RepDB deben tener sourceId únicos')

let packageAliasCount = 0
let validatedRepdbFiles = 0
for (const item of REPDB_MEDIA_ITEMS) {
  const exercise = repdbById.get(item.sourceId)
  assert.ok(exercise, `RepDB ${REPDB_PACKAGE_VERSION}: sourceId inexistente ${item.exerciseId} -> ${item.sourceId}`)
  const suffixes = item.variant === 'main' ? ['main'] : ['start', 'peak']
  for (const suffix of suffixes) {
    const declaredRelative = exercise.images?.flat?.[suffix]
    assert.equal(typeof declaredRelative, 'string', `RepDB ${item.sourceId}: falta pose ${suffix} en exercises.json`)
    assert.ok(declaredRelative.startsWith('images/flat/'), `RepDB ${item.sourceId}: path no-flat para ${suffix}`)
    assert.ok(declaredRelative.endsWith('.webp'), `RepDB ${item.sourceId}: asset no-WebP para ${suffix}`)

    const packageAsset = path.join(repdbPackageRoot, ...declaredRelative.split('/'))
    assert.ok(fs.existsSync(packageAsset), `RepDB ${item.sourceId}: asset declarado inexistente ${declaredRelative}`)

    const runtimeFilename = `${item.sourceId}-${suffix}.webp`
    const runtimeAsset = path.join(repdbRuntimeRoot, runtimeFilename)
    assert.ok(fs.existsSync(runtimeAsset), `RepDB ${item.sourceId}: asset runtime normalizado inexistente ${runtimeFilename}`)
    assert.deepEqual(
      fs.readFileSync(runtimeAsset),
      fs.readFileSync(packageAsset),
      `RepDB ${item.sourceId}/${suffix}: el asset runtime debe ser copia exacta del asset declarado por package`,
    )

    if (path.basename(declaredRelative) !== runtimeFilename) packageAliasCount += 1
    validatedRepdbFiles += 1
  }
}
assert.equal(validatedRepdbFiles, 49, 'Deben validarse exactamente 49 WebP seleccionados')
assert.ok(packageAliasCount >= 1, 'El test debe cubrir al menos un alias package filename -> runtime filename')
assert.ok(REPDB_PRECACHE_SOURCE_IDS.length > 0 && REPDB_PRECACHE_SOURCE_IDS.length < 26, 'No se deben precachear indiscriminadamente los 26 mappings RepDB')
assert.match(sync, /node_modules[\s\S]*@repdb[\s\S]*exercises/)
assert.match(sync, /LICENSE\.md/)
assert.match(sync, /ATTRIBUTION\.md/)
assert.match(sync, /normalizedAliases/)
assert.doesNotMatch(vite, /exercise-dataset\.com/)
assert.match(vite, /additionalManifestEntries:\s*repdbSeedThumbnails/)
assert.match(vite, /media\\\/exercises\\\/repdb/)

const repdbRegistry = EXERCISE_MEDIA_REGISTRY.filter((item) => item.source === 'repdb')
assert.deepEqual(
  repdbRegistry.map((item) => [item.exerciseId, item.sourceId]).sort(),
  REPDB_MEDIA_ITEMS.map((item) => [item.exerciseId, item.sourceId]).sort(),
  'Build manifest y registry runtime deben compartir exactamente los 26 mappings RepDB',
)

const curl = EXERCISE_MEDIA_REGISTRY.find((item) => item.exerciseId === 'ex-leg-curl')
assert.ok(curl)
assert.equal(curl.source, 'repdb')
assert.equal(curl.sourceId, 'leg-curl')
assert.equal(curl.motionProfile.kind, 'lying-leg-curl')

const hipThrust = EXERCISE_MEDIA_REGISTRY.find((item) => item.exerciseId === 'ex-hip-thrust')
assert.ok(hipThrust)
assert.equal(hipThrust.source, 'repdb')
assert.equal(hipThrust.sourceId, 'hip-thrust')

const standingCalf = EXERCISE_MEDIA_REGISTRY.find((item) => item.exerciseId === 'ex-standing-calf-raise')
assert.ok(standingCalf)
assert.equal(standingCalf.sourceId, 'standing-calf-raise')
assert.match(repdbById.get('standing-calf-raise').images.flat.start, /machine-calf-raise-start\.webp$/)
assert.match(standingCalf.startAsset ?? '', /standing-calf-raise-start\.webp$/)

for (const item of EXERCISE_MEDIA_REGISTRY) {
  assert.ok(item.staticAsset)
  assert.ok(item.motionId)
  assert.ok(item.licenseRef)
  assert.ok(item.primaryMuscles.length > 0)
  assert.ok(item.equipment.trim().length > 0)
  if (item.source === 'fenix') {
    assert.equal(item.offlinePolicy, 'precache-local')
    assert.equal(item.attribution, null)
    const relative = item.staticAsset.replace(/^\//, '')
    assert.ok(fs.existsSync(path.resolve(relative.startsWith('public/') ? relative : `public/${relative}`)), `Falta asset FÉNIX ${item.staticAsset}`)
  } else {
    assert.equal(item.offlinePolicy, 'package-local-cache-on-use')
    assert.match(item.staticAsset, /^\/media\/exercises\/repdb\/2026\.8\.1\//)
    assert.match(item.attribution ?? '', /RepDB/)
    assert.match(item.licenseRef, /@repdb\/exercises@2026\.8\.1/)
  }
}

console.log(`FÉNIX v2.1 Media Freeze: PASS (33/33 · 26 RepDB package-local · 49 WebP validated · ${packageAliasCount} package filename aliases normalized · 7 FÉNIX · selective precache · 33 motion registry entries; specificity reviewed separately)`)
