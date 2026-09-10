import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { EXERCISE_MEDIA_REGISTRY, LEGACY_EXERCISE_MEDIA_REGISTRY } from '../src/features/training/media/exerciseMediaRegistry.ts'
import { USER_LICENSED_MEDIA } from '../src/features/training/media/userMediaManifest.ts'

const inventory = JSON.parse(fs.readFileSync('qa/v2.1/evidence/USER_MEDIA_MAPPING.json', 'utf8'))
const sha = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex')
assert.equal(inventory.length, 33)
assert.equal(new Set(inventory.map(row => row.exerciseId)).size, 33)
assert.equal(Object.keys(USER_LICENSED_MEDIA).length, 31)
assert.deepEqual(EXERCISE_MEDIA_REGISTRY.map(row => row.exerciseId), LEGACY_EXERCISE_MEDIA_REGISTRY.map(row => row.exerciseId))
assert.equal(EXERCISE_MEDIA_REGISTRY.filter(row => row.source === 'user-licensed').length, 31)
assert.equal(EXERCISE_MEDIA_REGISTRY.filter(row => row.source === 'repdb').length, 1)
assert.equal(EXERCISE_MEDIA_REGISTRY.filter(row => row.source === 'fenix').length, 1)
for (const row of inventory) {
  assert.equal(sha(row.master), row.masterSHA256, `Master preserved: ${row.master}`)
  for (const [file, hash] of Object.entries(row.derivedSHA256)) {
    assert.equal(sha(path.join('public/media/exercises/user-licensed', file)), hash, `Derivative integrity: ${file}`)
  }
  const licensed = USER_LICENSED_MEDIA[row.exerciseId]
  const runtime = EXERCISE_MEDIA_REGISTRY.find(item => item.exerciseId === row.exerciseId)
  const legacy = LEGACY_EXERCISE_MEDIA_REGISTRY.find(item => item.exerciseId === row.exerciseId)
  if (row.status === 'INTEGRATED') {
    assert.deepEqual(licensed, row.runtime)
    assert.equal(runtime.staticAsset, licensed.poster)
    assert.equal(runtime.offlinePolicy, 'precache-local')
    assert.ok(runtime.fallbackAssets.includes(legacy.staticAsset))
    assert.equal(licensed.durations.length, row.frames)
    assert.ok(licensed.durations.every(duration => duration >= 20))
    assert.ok(licensed.peakFrame >= 0 && licensed.peakFrame < row.frames)
    for (const key of ['poster', 'peak', 'sprite']) assert.ok(licensed[key].startsWith('/media/exercises/user-licensed/'))
    if (row.frames > 1) assert.notEqual(row.derivedSHA256[path.basename(licensed.poster)], row.derivedSHA256[path.basename(licensed.peak)], 'Animated exercise must have materially different endpoint pixels')
  } else {
    assert.equal(licensed, undefined, 'Biomechanically mismatched master must not replace the correct exercise')
    assert.deepEqual(runtime, legacy)
  }
}
assert.equal(USER_LICENSED_MEDIA['ex-side-plank'].durations.length, 1, 'Static licensed hold uses specific SVG motion fallback')
assert.equal(USER_LICENSED_MEDIA['ex-lat-pulldown'], undefined)
assert.equal(USER_LICENSED_MEDIA['ex-chest-supported-tbar-row'], undefined)
console.log('PASS licensed media: 33 masters preserved; 31 mapped primaries + 2 correct existing primaries; derivatives, timing, endpoint pixels and offline fallback registry')
