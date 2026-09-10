import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const runnerPath = path.join(here, 'run-v21-domain-gate.mjs')
const runner = fs.readFileSync(runnerPath, 'utf8')

assert.match(runner, /fileURLToPath\(import\.meta\.url\)/, 'runner must convert its module URL with fileURLToPath')
assert.match(runner, /path\.dirname\(fileURLToPath\(import\.meta\.url\)\)/, 'runner must derive a filesystem directory')
assert.match(runner, /path\.join\(here, script\)/, 'runner must spawn child scripts using a native filesystem path')
assert.doesNotMatch(runner, /new URL\(script, import\.meta\.url\)\.pathname/, 'URL.pathname is not a portable child-process path on Windows')

for (const name of fs.readdirSync(here).filter((item) => item.endsWith('.mjs'))) {
  const source = fs.readFileSync(path.join(here, name), 'utf8')
  if (/from ['"]node:child_process['"]|require\(['"]node:child_process['"]\)/.test(source)) {
    assert.doesNotMatch(source, /\.pathname\b/, `${name}: child_process launcher must not receive URL.pathname`)
  }
}

console.log('FÉNIX v2.1 launcher portability: PASS (fileURLToPath + native paths · horizontal Windows sweep)')
