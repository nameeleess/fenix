import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
const read = file => fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')
const files = directory => fs.readdirSync(directory, {withFileTypes:true}).flatMap(entry => entry.isDirectory() ? files(path.join(directory,entry.name)) : [path.join(directory,entry.name)])
for (const file of files('src')) {
  if (!/\.(tsx?|css)$/.test(file)) continue
  assert.doesNotMatch(read(file), /(?:import|@import)[^\n]*(?:final-v\d|final-rc|mobile-density|render-parity|visual-polish)\.css/, `${file}: tactical style layer imported`)
}
for (const legacy of ['final-v1.css','final-v2.css','final-rc.css','mobile-density.css','render-parity.css','visual-polish.css']) assert.ok(!fs.existsSync(`src/styles/${legacy}`), `Runtime legacy layer: ${legacy}`)
const contract=JSON.parse(read('qa/v2.1/golden-screen-contract.json'))
assert.equal(contract.goldenZipSHA256,'0f797dd2962f44ec7ae82d46f770d6b70c462927ad6a938728ea86375056bffc')
assert.equal(Object.keys(contract.states).length,26)
for(const [name,row] of Object.entries(contract.states)) {
  assert.match(row.goldenSHA256,/^[a-f0-9]{64}$/)
  assert.equal(row.crop.length,4)
  const [x,y,w,h]=row.crop
  assert.ok(x>=0&&y>=0&&w>0&&h>0&&x+w<=941&&y+h<=1672,`${name}: crop outside original`)
  assert.ok(Math.abs(h*row.viewport[0]/w-row.viewport[1])*row.deviceScaleFactor<=2,`${name}: nonuniform scaling`)
}
const visual=read('qa/v2.1/e2e/visual.spec.ts')
assert.equal((visual.match(/test\('@visual \d\d /g)||[]).length,26)
assert.match(visual,/seedGoldenVisualFacts\(page,/)
assert.doesNotMatch(visual,/locator\('\.training-catalog-card--button'\)\.first\(\)/)
const helpers=read('qa/v2.1/e2e/helpers.ts')
assert.match(helpers,/receipt\.entities\)\.toEqual\(\['ex-bench-press'\]\)/)
assert.match(helpers,/document\.fonts\.ready/)
assert.match(helpers,/CAPTURE_ONLY_NOT_PARITY/)
const comparator=read('scripts/compare-golden-derived.py')
assert.match(comparator,/sampleStep=1/)
assert.match(comparator,/ImageChops\.difference/)
assert.match(comparator,/rawDiffSHA256/)
assert.match(comparator,/Immutable Golden changed/)
assert.doesNotMatch(comparator,/reviewStatus=['"]PASS/)
assert.match(read('scripts/compare-golden-derived.ps1'),/compare-golden-derived\.py/)
console.log('Visual source/crop ownership contracts PASS; this is not visual parity. Final artifact review is a separate fail-closed gate.')
