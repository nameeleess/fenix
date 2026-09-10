import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const scripts = fs.readdirSync(here)
  .filter((name) => /^test-v21-.*\.mjs$/.test(name))
  .sort()

for (const script of scripts) {
  const result = spawnSync(process.execPath, ['--experimental-strip-types', path.join(here, script)], { stdio: 'inherit' })
  if (result.status !== 0) process.exit(result.status ?? 1)
}
console.log(`FÉNIX v2.1 domain gate: PASS (${scripts.length} suites)`)
