import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { pathToFileURL } from 'node:url'

export const VISUAL_AXES = ['STRUCT','GEO','TYPE','SPACE','COLOR','ICON','MEDIA','INTERACTION']
const sha = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex')
const requireThat = (value, message) => { if (!value) throw new Error(message) }

// Fail closed. Capture and comparator completion are deliberately not parity.
export function validateVisualRow(row, comparison, contract, root = process.cwd()) {
  requireThat(row.state === comparison.state, 'Wrong comparison state')
  requireThat(row.result === 'PASS', `${row.state}: visual review not PASS`)
  requireThat(comparison.sampleStep === 1, 'Sparse pixel comparisons are invalid')
  requireThat(JSON.stringify(comparison.viewport) === JSON.stringify(contract.viewport), 'Wrong viewport')
  requireThat(JSON.stringify(Object.values(comparison.crop)) === JSON.stringify(contract.crop), 'Wrong crop')
  requireThat(comparison.goldenSHA256 === contract.goldenSHA256, 'Wrong Golden')
  for (const [fileKey, hashKey] of [
    ['goldenOriginal','goldenSHA256'], ['derivedCrop','derivedCropSHA256'], ['actual','actualSHA256'],
    ['visualDiff','visualDiffSHA256'], ['rawDiff','rawDiffSHA256'], ['comparison','comparisonSHA256'],
  ]) {
    requireThat(comparison[fileKey] && comparison[hashKey], `Missing ${fileKey} artifact/hash`)
    requireThat(sha(path.resolve(root, comparison[fileKey])) === comparison[hashKey], `Stale ${fileKey} artifact`)
    requireThat(row.artifacts?.[hashKey] === comparison[hashKey], `Review not bound to ${fileKey}`)
  }
  const receipt = JSON.parse(fs.readFileSync(path.resolve(root, `${comparison.actual}.receipt.json`), 'utf8'))
  requireThat(receipt.state === row.state && receipt.actualSHA256 === comparison.actualSHA256, 'Stale/wrong capture receipt')
  requireThat(JSON.stringify(receipt.viewport) === JSON.stringify(contract.viewport), 'Capture viewport mismatch')
  for (const [file, key] of [['qa/v2.1/e2e/helpers.ts','fixtureSHA256'], ['qa/v2.1/e2e/activeGoldenFixture.ts','activeFixtureSHA256'], ['qa/v2.1/e2e/visual.spec.ts','harnessSHA256'], ['qa/v2.1/golden-screen-contract.json','contractSHA256'], ['dist/index.html','buildIndexSHA256']]) {
    requireThat(sha(path.resolve(root,file)) === receipt[key], `Stale ${key}`)
  }
  if (row.state.startsWith('09_')) requireThat(JSON.stringify(receipt.entities) === '["ex-bench-press"]', 'G09 wrong exercise identity')
  requireThat(row.fixtureReview?.result === 'PASS' && row.fixtureReview.evidence?.length > 30, 'Missing entity/state review')
  for (const axis of VISUAL_AXES) {
    const review = row.axes?.[axis]
    requireThat(review?.result === 'PASS' && review.observation?.length > 30, `Missing substantive ${axis} review`)
  }
  requireThat(row.pixelReview?.meanAbsoluteError === comparison.meanAbsoluteError && row.pixelReview?.changedPixelRate === comparison.changedPixelRate, 'Review has stale pixel metrics')
  requireThat(row.pixelReview?.materialDifference === false, 'Material pixel difference not closed')
  requireThat(row.pixelReview?.explanation?.length > 80, 'Pixel residuals need a quantified technical explanation')
  requireThat(!/conceptually|conceptual similarity|capture exists|screen reachable/i.test(JSON.stringify(row)), 'Conceptual/capture-only review is prohibited')
  return true
}

export function validateVisualEvidence(review, comparisons, spec, root) {
  requireThat(review.length === 26 && comparisons.length === 26 && Object.keys(spec.states).length === 26, 'Exactly 26 states required')
  requireThat(new Set(review.map(row => row.state)).size === 26, 'Duplicate visual state')
  for (const row of review) {
    const contract = spec.states[row.state]
    const comparison = comparisons.find(item => item.state === row.state)
    requireThat(contract && comparison, `Unmapped state ${row.state}`)
    validateVisualRow(row, comparison, contract, root)
  }
  return true
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [reviewPath, comparisonPath, specPath = 'qa/v2.1/golden-screen-contract.json'] = process.argv.slice(2)
  if (!reviewPath || !comparisonPath) throw new Error('Usage: node scripts/validate-visual-evidence.mjs REVIEW.json COMPARISON.json [SPEC.json]')
  const read = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''))
  validateVisualEvidence(read(reviewPath), read(comparisonPath), read(specPath), process.cwd())
  console.log('26/26 evidence completeness and freshness PASS; review observations remain independently auditable.')
}
