import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const declarationPath = path.resolve('scripts', 'media-freeze-v21.d.mts')
const viteConfigPath = path.resolve('vite.config.ts')
const tsconfigNodePath = path.resolve('tsconfig.node.json')
const tscPath = path.resolve('node_modules', 'typescript', 'bin', 'tsc')

assert.ok(fs.existsSync(declarationPath), 'Falta declaración TypeScript adyacente para media-freeze-v21.mjs')
assert.ok(fs.existsSync(tscPath), 'Falta TypeScript local instalado por npm ci')

const declaration = fs.readFileSync(declarationPath, 'utf8')
const viteConfig = fs.readFileSync(viteConfigPath, 'utf8')
const tsconfigNodeSource = fs.readFileSync(tsconfigNodePath, 'utf8')

assert.match(declaration, /RepdbMediaVariant\s*=\s*'start-peak'\s*\|\s*'main'/)
assert.match(declaration, /interface\s+RepdbMediaItem/)
assert.match(declaration, /readonly\s+exerciseId:\s*string/)
assert.match(declaration, /readonly\s+sourceId:\s*string/)
assert.match(declaration, /readonly\s+variant:\s*RepdbMediaVariant/)
assert.match(declaration, /REPDB_PACKAGE_VERSION:\s*string/)
assert.match(declaration, /REPDB_MEDIA_ITEMS:\s*readonly\s+RepdbMediaItem\[\]/)
assert.match(declaration, /REPDB_PRECACHE_SOURCE_IDS:\s*readonly\s+string\[\]/)
assert.match(viteConfig, /from\s+['"]\.\/scripts\/media-freeze-v21\.mjs['"]/)
assert.match(
  tsconfigNodeSource,
  /"module"\s*:\s*"nodenext"/i,
  'tsconfig.node.json debe conservar module=nodenext',
)
assert.match(
  tsconfigNodeSource,
  /"include"\s*:\s*\[\s*"vite\.config\.ts"\s*\]/s,
  'tsconfig.node.json debe seguir typechecking vite.config.ts',
)

const result = spawnSync(
  process.execPath,
  [tscPath, '-p', 'tsconfig.node.json', '--pretty', 'false'],
  { stdio: 'inherit' },
)

assert.equal(
  result.status,
  0,
  `Contrato TypeScript de vite.config.ts/media-freeze-v21.mjs falló con exit ${result.status ?? 'null'}`,
)

console.log('FÉNIX v2.1 config/media TypeScript contract: PASS (NodeNext .mjs -> .d.mts + tsconfig.node typecheck)')
