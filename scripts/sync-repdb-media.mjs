import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { REPDB_MEDIA_ITEMS, REPDB_PACKAGE_VERSION } from './media-freeze-v21.mjs'

const projectRoot = process.cwd()
const packageRoot = path.join(projectRoot, 'node_modules', '@repdb', 'exercises')
const datasetPath = path.join(packageRoot, 'exercises.json')
const destinationRoot = path.join(projectRoot, 'public', 'media', 'exercises', 'repdb', REPDB_PACKAGE_VERSION)

async function requireFile(filePath, label) {
  try {
    await fs.access(filePath)
  } catch {
    throw new Error(`RepDB media sync: falta ${label}: ${filePath}`)
  }
}

await requireFile(path.join(packageRoot, 'package.json'), '@repdb/exercises/package.json')
await requireFile(datasetPath, '@repdb/exercises/exercises.json')
await requireFile(path.join(packageRoot, 'LICENSE.md'), '@repdb/exercises/LICENSE.md')
await requireFile(path.join(packageRoot, 'ATTRIBUTION.md'), '@repdb/exercises/ATTRIBUTION.md')

const packageMeta = JSON.parse(await fs.readFile(path.join(packageRoot, 'package.json'), 'utf8'))
if (packageMeta.version !== REPDB_PACKAGE_VERSION) {
  throw new Error(`RepDB media sync: versión instalada ${packageMeta.version ?? 'desconocida'}; se exige ${REPDB_PACKAGE_VERSION}`)
}

const dataset = JSON.parse(await fs.readFile(datasetPath, 'utf8'))
if (!Array.isArray(dataset.exercises)) {
  throw new Error('RepDB media sync: exercises.json no contiene exercises[]')
}

const exerciseById = new Map()
for (const exercise of dataset.exercises) {
  if (!exercise?.id || exerciseById.has(exercise.id)) {
    throw new Error(`RepDB media sync: id ausente o duplicado en exercises.json: ${exercise?.id ?? 'null'}`)
  }
  exerciseById.set(exercise.id, exercise)
}

const copyPlan = []
const normalizedAliases = []
for (const item of REPDB_MEDIA_ITEMS) {
  const exercise = exerciseById.get(item.sourceId)
  if (!exercise) {
    throw new Error(`RepDB media sync: sourceId no existe en package ${REPDB_PACKAGE_VERSION}: ${item.exerciseId} -> ${item.sourceId}`)
  }

  const suffixes = item.variant === 'main' ? ['main'] : ['start', 'peak']
  for (const suffix of suffixes) {
    const declaredRelative = exercise.images?.flat?.[suffix]
    if (typeof declaredRelative !== 'string' || !declaredRelative.startsWith('images/flat/') || !declaredRelative.endsWith('.webp')) {
      throw new Error(`RepDB media sync: pose flat ${suffix} inválida o ausente para ${item.sourceId}`)
    }

    const source = path.join(packageRoot, ...declaredRelative.split('/'))
    await requireFile(source, `${item.sourceId}/${suffix}`)

    const runtimeFilename = `${item.sourceId}-${suffix}.webp`
    if (path.basename(declaredRelative) !== runtimeFilename) {
      normalizedAliases.push({
        sourceId: item.sourceId,
        suffix,
        packageAsset: declaredRelative,
        runtimeAsset: `images/flat/${runtimeFilename}`,
      })
    }

    copyPlan.push({
      source,
      destination: path.join(destinationRoot, runtimeFilename),
    })
  }
}

if (REPDB_MEDIA_ITEMS.length !== 26 || copyPlan.length !== 49) {
  throw new Error(`RepDB media sync: freeze incompleto: mappings=${REPDB_MEDIA_ITEMS.length}; files=${copyPlan.length}`)
}

await fs.rm(destinationRoot, { recursive: true, force: true })
await fs.mkdir(destinationRoot, { recursive: true })

for (const entry of copyPlan) {
  await fs.copyFile(entry.source, entry.destination)
}

await fs.writeFile(
  path.join(destinationRoot, 'FENIX_MEDIA_BUILD.json'),
  `${JSON.stringify({
    package: '@repdb/exercises',
    version: REPDB_PACKAGE_VERSION,
    mappings: REPDB_MEDIA_ITEMS.length,
    files: copyPlan.length,
    datasetValidated: true,
    normalizedAliasCount: normalizedAliases.length,
    normalizedAliases,
  }, null, 2)}\n`,
  'utf8',
)

console.log(`FÉNIX v2.1 RepDB media sync: PASS (${REPDB_MEDIA_ITEMS.length} mappings · ${copyPlan.length} local WebP · package ${REPDB_PACKAGE_VERSION} · ${normalizedAliases.length} package filename aliases normalized)`)
