import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'

const expected = new Map([
  ['package.json', 'b5e126924ee9c88d9d0231f6c41e99615be29eee23682882f92047b823aa7b16'],
  ['package-lock.json', '18360bc1f5fd6acd41979236267f4b84fb67d8fc7b0661733b1957dca1e86f2a'],
  ['src/db/database.ts', 'efff63a6c4f1f641ee9283d10d4dabaedabd269ff15515592b688ec6a580e677'],
  ['src/app/freshnessEvents.ts', '08b61891536f56c541bf82fbc6ac6fd285a2633fac5cfea756627b6aebe4c417'],
  ['src/app/useAppFreshness.ts', '60d7d4e0175bbb6d46bedfd6b1d5c01939deb340c8ea4dbd254ee01464e648bd'],
  ['src/features/today/todayService.ts', '1e989fcae68bb124e6a9c9adb57c187438e853d1713212efa10c4148068999d5'],
  ['src/features/nutrition/dailyMealIdentity.ts', 'f6fba0436d8efef946a02d35f574e5aa201bc598c0256a5e0f50bb29c2d9b0e6'],
  ['src/features/progress/trainingStreak.ts', '025c9bebb2e4174753de28b28768bced0ab4fe0fb94b480c885ba6c70a9b70e6'],
  ['src/features/training/trainingSeed.ts', 'e04a978ef83ef15bc384477d5195a6f60e0c6535ff2ec7be35c7946c2ca423f2'],
  ['src/features/nutrition/nutritionSeed.ts', '55af4cda81b0a94479f8ab6a2aedafa0bd5f22100a2a0b5c3f377447524373e1'],
  ['src/features/today/todaySeed.ts', '5fdb46e76a6c1b1d0af4a7ee1e0a085bd1139a3fcc793ee11d481240713c5a9d'],
  ['src/features/progress/progressSeed.ts', 'aa084e6359d8a454823d4db6e2dbb61b8adc2aa5bcd3fc36bb561d39f653476f'],
  ['src/services/vNextMigrationService.ts', '47319a288ec4ad8599fd020e4f05278185e5ac9543f55d13604f99b5ce648098'],
])

for (const [relativePath, digest] of expected) {
  const data = await readFile(new URL(`../${relativePath}`, import.meta.url))
  const actual = createHash('sha256').update(data).digest('hex')
  assert.equal(actual, digest, `${relativePath} must remain byte-identical to closed b01.5`)
}

console.log(`F2-B02/RC2 protected immutable b01.5 baseline: PASS (${expected.size} files; Nutrition vNext and authorized streak comparator covered by semantic regression)`)
