import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const root = process.cwd()
const policyPath = path.join(root, 'qa/v2.1/golden-region-mask-policy.json')
const receiptDir = path.join(root, 'qa/v2.1/evidence/screenshots')
const outputPath = path.join(root, 'qa/v2.1/evidence/golden-region-mask-manifest.json')
const policy = JSON.parse(fs.readFileSync(policyPath, 'utf8'))
const sha = value => crypto.createHash('sha256').update(value).digest('hex')
const allowed = /(phoenix-art|anatomy|visual__media|recipe-visual|meal__visual|today-dashboard-card|today-hero|CENTRAL-AUTOEXCEPTION)/
const states = {}

for (const [screen, rule] of Object.entries(policy.states)) {
  const receiptPath = path.join(receiptDir, `${screen}.receipt.json`)
  const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'))
  const regions = []
  if (policy.defaultSemanticCandidates) {
    for (const [index, candidate] of receipt.visualRegionCandidates.entries()) {
      if (!allowed.test(candidate.selectorHint)) continue
      regions.push({
        x: candidate.x, y: candidate.y, w: candidate.w, h: candidate.h,
        id: `CENTRAL-REGION-${screen.slice(0, 2)}-MEDIA-${String(index + 1).padStart(2, '0')}`,
        reason: `Approved brand/media raster slot declared from capture DOM geometry (${candidate.selectorHint}).`,
        source: 'semantic-dom-receipt'
      })
    }
  }
  for (const explicit of rule.explicit ?? []) regions.push({ ...explicit, source: 'central-exception-policy' })
  states[screen] = { viewport: receipt.viewport, deviceScaleFactor: receipt.deviceScaleFactor, regions }
}

const manifest = {
  formatVersion: 1,
  immutablePolicySHA256: sha(fs.readFileSync(policyPath)),
  generatedFrom: 'semantic capture receipts and predeclared CENTRAL exception rectangles; never from visual diffs',
  states,
}
fs.writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`)
console.log(`${Object.keys(states).length} mask declarations written to ${path.relative(root, outputPath)}; SHA256=${sha(fs.readFileSync(outputPath))}`)
