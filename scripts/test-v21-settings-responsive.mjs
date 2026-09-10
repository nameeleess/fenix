import assert from 'node:assert/strict'
import fs from 'node:fs'

const css = fs.readFileSync('src/features/settings/settings.css', 'utf8')

assert.match(css, /\.settings-routine\s*\{[\s\S]*?min-width:\s*0/)
assert.match(css, /\.settings-wake\s*\{[\s\S]*?grid-template-columns:\s*32px\s+minmax\(0,\s*1fr\)/)
assert.match(css, /\.settings-routine-item__fields input,[\s\S]*?\.settings-routine-item__fields select\s*\{[\s\S]*?width:\s*100%[\s\S]*?min-width:\s*0/)
assert.match(css, /\.settings-routine-items article\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)\s+44px/)
assert.match(css, /\.settings-routine-item__fields\s*>\s*div\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)\s+minmax\(0,\s*1fr\)/)
assert.doesNotMatch(css, /settings-routine[^\{]*\{[^}]*overflow-x\s*:\s*hidden/i)

console.log('FÉNIX v2.1 Settings responsive contract: PASS (nested grid shrinkability · minmax(0,fr) · no overflow masking)')
