import fs from 'node:fs'
import path from 'node:path'

const manifestPath = process.argv[2] ?? 'qa/v2.1/evidence/golden-derived-rc12/manifest.json'
const fixturesPath = 'qa/v2.1/evidence/CANONICAL_GOLDEN_FIXTURES_RC12.json'
const outputPath = process.argv[3] ?? 'qa/v2.1/evidence/VISUAL_REVIEW_26_RC12.md'
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
const fixtures = JSON.parse(fs.readFileSync(fixturesPath, 'utf8'))
const manual = JSON.parse(fs.readFileSync('qa/v2.1/visual-manual-review.json', 'utf8'))
if (manifest.length !== 26 || Object.keys(fixtures.states).length !== 26) throw new Error('Expected 26 canonical visual states')

const axes = 'STRUCT · GEO · TYPE · SPACE · COLOR · ICON · MEDIA · INTERACTION'
const lines = [
  '# VISUAL REVIEW — RC1.2 / DERIVED GOLDEN EVIDENCE',
  '',
  'Golden originals remain immutable. Each row below is tied to a deterministic useful-screen crop, actual capture, visual diff and SHA-256 manifest. A screenshot is never treated as parity by existence alone.',
  '',
  'Crop parameters are recorded in `' + path.posix.normalize(manifestPath).replaceAll('\\', '/') + '`; immutable Golden package SHA-256: `' + fixtures.goldenZipSha256 + '`.',
  '',
  '| # | State | Canonical fixture/entity | Golden SHA | Crop SHA | Actual SHA | Mask SHA / coverage | Raw MAE / changed | Masked MAE / changed | Axes | Result |',
  '|---:|---|---|---|---|---|---|---:|---:|---|---|',
]
for (const row of manifest) {
  const f = fixtures.states[row.state]
  if (!f) throw new Error(`Fixture missing for ${row.state}`)
  const n = row.state.slice(0, 2)
  const exception = f.exception ? ` (${f.exception})` : ''
  const review = manual.states[row.state]
  const result = row.reviewStatus === 'READY_FOR_MANUAL_REVIEW' && review?.result === 'PASS' ? 'PASS' : row.reviewStatus
  lines.push('| ' + n + ' | ' + row.state.replace('.png', '') + ' | ' + f.state + ' / ' + (f.entity ?? f.fixture) + exception + ' | `' + row.goldenSHA256 + '` | `' + row.derivedCropSHA256 + '` | `' + row.actualSHA256 + '` | `' + row.maskSHA256 + '` / ' + (row.maskCoverage * 100).toFixed(2) + '% | ' + row.rawMeanAbsoluteError + ' / ' + row.rawChangedPixelRate + ' | ' + row.meanAbsoluteError + ' / ' + row.changedPixelRate + ' | ' + axes + ' | **' + result + '** |')
}
lines.push('', '## Rule', '', 'The full raw diff is always retained. Masks are immutable rectangles declared before comparison and limited to approved brand/media raster slots or explicit CENTRAL exceptions. Rows with `FAIL_MATERIAL_DIFF` cannot be promoted to PASS; capture existence never establishes parity.', '')
fs.writeFileSync(outputPath, lines.join('\n'))
console.log(`Wrote ${outputPath} for ${manifest.length}/26 states`)
