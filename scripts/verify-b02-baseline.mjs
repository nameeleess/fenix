import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'

const expected = new Map([
  ['src/db/database.ts', 'efff63a6c4f1f641ee9283d10d4dabaedabd269ff15515592b688ec6a580e677'],
  ['src/app/freshnessEvents.ts', '08b61891536f56c541bf82fbc6ac6fd285a2633fac5cfea756627b6aebe4c417'],
  ['src/app/useAppFreshness.ts', '60d7d4e0175bbb6d46bedfd6b1d5c01939deb340c8ea4dbd254ee01464e648bd'],
  ['src/features/nutrition/dailyMealIdentity.ts', 'f6fba0436d8efef946a02d35f574e5aa201bc598c0256a5e0f50bb29c2d9b0e6'],
  ['src/features/progress/trainingStreak.ts', '025c9bebb2e4174753de28b28768bced0ab4fe0fb94b480c885ba6c70a9b70e6'],
  ['src/features/today/todaySeed.ts', '5fdb46e76a6c1b1d0af4a7ee1e0a085bd1139a3fcc793ee11d481240713c5a9d'],
  ['src/features/progress/progressSeed.ts', 'aa084e6359d8a454823d4db6e2dbb61b8adc2aa5bcd3fc36bb561d39f653476f'],
])

for (const [relativePath, digest] of expected) {
  const data = await readFile(new URL(`../${relativePath}`, import.meta.url))
  const actual = createHash('sha256').update(data).digest('hex')
  assert.equal(actual, digest, `${relativePath} must remain byte-identical to closed b01.5`)
}

console.log(`F2-B02/v2.1 protected immutable CORE baseline: PASS (${expected.size} untouched files; authorized v2.1 surfaces covered by semantic regression)`)
