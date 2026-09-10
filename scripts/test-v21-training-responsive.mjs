import assert from 'node:assert/strict'
import fs from 'node:fs'

const css = fs.readFileSync('src/features/training/training.css', 'utf8')
const helpers = fs.readFileSync('qa/v2.1/e2e/helpers.ts', 'utf8')
const visual = fs.readFileSync('qa/v2.1/e2e/visual.spec.ts', 'utf8')

assert.match(css, /\.training-exercise-catalog--grid>\*\{min-width:0\}/, 'catalog grid children must be shrinkable')
assert.match(css, /\.training-catalog-card--button\{width:100%;min-width:0;/, 'catalog cards must not impose intrinsic min width')
assert.match(css, /\.training-catalog-card--button \.training-catalog-card__heading>div\{min-width:0;flex:1 1 auto\}/, 'catalog heading copy must be shrinkable')
assert.match(css, /training-catalog-card__heading h3,[^\n]*training-catalog-card__heading p\{overflow-wrap:anywhere\}/, 'catalog text must wrap rather than expand viewport')
assert.match(helpers, /offenders=.*JSON\.stringify\(overflow\.offenders\)/, 'visual gate must report overflow offenders')
assert.match(helpers, /visualOverflowFailures\.push/, 'visual gate must aggregate overflow failures instead of stopping at the first state')
assert.match(visual, /resetVisualStateChecks\(\)/, 'each independent visual state must reset overflow diagnostics before capture')
assert.match(visual, /assertVisualStateChecks\(\)/, 'each independent visual state must fail on its own overflow after capture')
assert.match(helpers, /item\.right > viewportWidth \+ 2 \|\| item\.left < -2/, 'visual diagnostic must detect both right and left overflow')

console.log('FÉNIX v2.1 Training responsive overflow contract: PASS (shrinkable catalog cards · wrap-safe copy · visual offender diagnostics)')
