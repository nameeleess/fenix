import assert from 'node:assert/strict'
import fs from 'node:fs'

const config = fs.readFileSync('qa/v2.1/playwright.config.ts', 'utf8')
const setup = fs.readFileSync('qa/v2.1/previewSetup.ts', 'utf8')
const helpers = fs.readFileSync('qa/v2.1/e2e/helpers.ts', 'utf8')

assert.match(config, /const previewOrigin = 'http:\/\/127\.0\.0\.1:41731'/, 'Playwright must own a dedicated preview origin')
assert.match(config, /baseURL:\s*previewOrigin/, 'baseURL must use the dedicated preview origin')
assert.match(config, /globalSetup:\s*'.\/previewSetup.ts'/, 'runner must own preview lifetime')
assert.match(setup, /port:\s*41731,\s*strictPort:\s*true/, 'occupied preview port must fail instead of reusing a server')
assert.match(setup, /httpServer.closeAllConnections\(\)/, 'teardown must close private HTTP connections')
assert.match(setup, /httpServer.close\(/, 'teardown must release the private listener')
assert.match(config, /serviceWorkers:\s*'allow'/, 'PWA browser gate must explicitly allow service workers')
assert.ok(!config.includes("127.0.0.1:4173'"), 'legacy shared preview origin 4173 must not remain')

assert.match(helpers, /waitUntil:\s*'domcontentloaded'/, 'boot helper must use deterministic navigation readiness')
assert.match(helpers, /heading'.*Hoy|heading.*name:\s*'Hoy'/s, 'openApp must wait for Today as the stable ready surface')
assert.match(helpers, /page\.on\('pageerror'/, 'boot helper must capture runtime page errors')
assert.match(helpers, /message\.type\(\) === 'error'/, 'boot helper must capture browser console errors')
assert.match(helpers, /navigator\.serviceWorker\.getRegistrations\(\)/, 'boot failure diagnostics must report service-worker state')
assert.match(helpers, /page\.waitForTimeout\(300\)/, 'boot helper must reject immediate reload/update races')
assert.match(helpers, /new Error\([\s\S]*\{ cause: error \}\)/, 'boot diagnostic rethrow must preserve the caught error as cause')

console.log('FÉNIX v2.1 Playwright hermetic boot: PASS (dedicated preview · no server reuse · stable Today boot · runtime diagnostics)')
