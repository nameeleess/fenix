import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from '@playwright/test'

const configDir = path.dirname(fileURLToPath(import.meta.url))
const evidenceDir = path.join(configDir, 'evidence')
const previewOrigin = 'http://127.0.0.1:41731'

export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: [
    ['line'],
    ['json', { outputFile: path.join(evidenceDir, 'playwright-results.json') }],
  ],
  outputDir: path.join(evidenceDir, 'playwright-artifacts'),
  globalSetup: './previewSetup.ts',
  use: {
    baseURL: previewOrigin,
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    colorScheme: 'dark',
    reducedMotion: 'reduce',
    serviceWorkers: 'allow',
    locale: 'es-ES',
    timezoneId: 'Europe/Madrid',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
})
