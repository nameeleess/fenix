import assert from 'node:assert/strict'
import fs from 'node:fs'

const config = fs.readFileSync(new URL('../qa/v2.1/playwright.config.ts', import.meta.url), 'utf8')
const core = fs.readFileSync(new URL('../qa/v2.1/e2e/core.spec.ts', import.meta.url), 'utf8')

assert.match(config, /fileURLToPath\(import\.meta\.url\)/)
assert.match(config, /const evidenceDir = path\.join\(configDir, 'evidence'\)/)
assert.match(config, /outputFile: path\.join\(evidenceDir, 'playwright-results\.json'\)/)
assert.match(config, /outputDir: path\.join\(evidenceDir, 'playwright-artifacts'\)/)
assert.doesNotMatch(config, /outputFile:\s*['"]qa\/v2\.1\/evidence/)
assert.doesNotMatch(config, /outputDir:\s*['"]qa\/v2\.1\/evidence/)

const offlineTestStart = core.indexOf("test('offline after valid load")
const offlineToggle = core.indexOf('await context.setOffline(true)', offlineTestStart)
const offlineEventAssertion = core.indexOf("await expect(page.getByText(/Sin conexión/)).toBeVisible()", offlineToggle)
const offlineReload = core.indexOf("await page.reload({ waitUntil: 'domcontentloaded' })", offlineEventAssertion)
assert.ok(
  offlineTestStart > 0 && offlineToggle > offlineTestStart && offlineEventAssertion > offlineToggle && offlineReload > offlineEventAssertion,
  'offline indicator must be asserted after the live offline event and before the offline reload',
)
assert.match(core, /form\.requestSubmit\(submit\)\s*\n\s*form\.requestSubmit\(submit\)/)
assert.doesNotMatch(core, /saveMeal\.dblclick/)
assert.doesNotMatch(core, /saveGoal\.dblclick/)

console.log('FÉNIX v2.1 Playwright harness contract: PASS (offline-event vs offline-reload semantics · logical double-submit · canonical evidence paths)')
