import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { validateVisualRow, validateVisualEvidence, VISUAL_AXES } from './validate-visual-evidence.mjs'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fenix-visual-guard-'))
const hash = value => createHash('sha256').update(value).digest('hex')
const write = (file, text) => { const target=path.join(root,file); fs.mkdirSync(path.dirname(target),{recursive:true}); fs.writeFileSync(target,text); return hash(text) }
try {
  const state='09_TRAINING_Detalle_ejercicio.png'
  const comparison={state,sampleStep:1,viewport:[393,771],crop:{x:107,y:134,width:717,height:1406},meanAbsoluteError:1.25,changedPixelRate:.002}
  const artifacts={}
  for(const [fileKey,hashKey] of [['goldenOriginal','goldenSHA256'],['derivedCrop','derivedCropSHA256'],['actual','actualSHA256'],['visualDiff','visualDiffSHA256'],['rawDiff','rawDiffSHA256'],['comparison','comparisonSHA256']]) {
    comparison[fileKey]=`${fileKey}.test`; comparison[hashKey]=write(comparison[fileKey],`isolated guard test: ${fileKey}`); artifacts[hashKey]=comparison[hashKey]
  }
  const receipt={state,actualSHA256:comparison.actualSHA256,viewport:comparison.viewport,entities:['ex-bench-press']}
  for(const [file,key] of [['qa/v2.1/e2e/helpers.ts','fixtureSHA256'],['qa/v2.1/e2e/activeGoldenFixture.ts','activeFixtureSHA256'],['qa/v2.1/e2e/visual.spec.ts','harnessSHA256'],['qa/v2.1/golden-screen-contract.json','contractSHA256'],['dist/index.html','buildIndexSHA256']]) receipt[key]=write(file,file)
  const saveReceipt = () => write(`${comparison.actual}.receipt.json`,JSON.stringify(receipt))
  saveReceipt()
  const contract={viewport:comparison.viewport,crop:Object.values(comparison.crop),goldenSHA256:comparison.goldenSHA256}
  const row={state,result:'PASS',artifacts,fixtureReview:{result:'PASS',evidence:'Isolated validator test for canonical exercise bench identity.'},
    axes:Object.fromEntries(VISUAL_AXES.map(axis=>[axis,{result:'PASS',observation:`Isolated validator test contains substantive ${axis} review observations.`}])),
    pixelReview:{meanAbsoluteError:1.25,changedPixelRate:.002,materialDifference:false,explanation:'Isolated validator test: residual 0.2 percent of pixels, MAE 1.25, bounded to glyph antialiasing; no material geometry displacement.'}}
  assert.equal(validateVisualRow(row,comparison,contract,root),true)
  assert.throws(()=>validateVisualRow({state,result:'PASS'},comparison,contract,root),/Review not bound/)
  assert.throws(()=>validateVisualRow(row,{...comparison,rawDiff:undefined},contract,root),/Missing rawDiff/)
  assert.throws(()=>validateVisualRow(row,{...comparison,sampleStep:8},contract,root),/Sparse/)
  assert.throws(()=>validateVisualRow({...row,axes:{...row.axes,GEO:{result:'PASS',observation:''}}},comparison,contract,root),/GEO/)
  assert.throws(()=>validateVisualRow({...row,pixelReview:{...row.pixelReview,materialDifference:true}},comparison,contract,root),/Material/)
  receipt.entities=['ex-90-90-hip-switch'];saveReceipt()
  assert.throws(()=>validateVisualRow(row,comparison,contract,root),/G09 wrong/)
  receipt.entities=['ex-bench-press'];saveReceipt()
  write('qa/v2.1/e2e/helpers.ts','changed after screenshot')
  assert.throws(()=>validateVisualRow(row,comparison,contract,root),/Stale fixture/)
  write('qa/v2.1/e2e/helpers.ts','qa/v2.1/e2e/helpers.ts')
  write(comparison.actual,'changed screenshot')
  assert.throws(()=>validateVisualRow(row,comparison,contract,root),/Stale actual/)
  assert.throws(()=>validateVisualEvidence([row],[comparison],{states:{[state]:contract}},root),/Exactly 26/)
  console.log('Visual evidence guard: valid isolated record + 9 adversarial rejection cases PASS (not application parity).')
} finally {
  assert.equal(path.dirname(path.resolve(root)),path.resolve(os.tmpdir()))
  assert.ok(path.basename(root).startsWith('fenix-visual-guard-'))
  fs.rmSync(root,{recursive:true,force:true})
}
