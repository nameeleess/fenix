import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { openApp, mainNav, segmented, readStore } from './helpers'
import { EXERCISE_MEDIA_REGISTRY } from '../../../src/features/training/media/exerciseMediaRegistry'
import { USER_LICENSED_MEDIA } from '../../../src/features/training/media/userMediaManifest'

test('33 catalog motions: endpoints, pause, reduced motion and offline', async ({ page, context }) => {
  test.setTimeout(300_000)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await openApp(page)
  await mainNav(page, 'Training')
  await segmented(page, 'Secciones de Training', 'Ejercicios')
  const exercises = await readStore<{ id: string; name: string }>(page, 'exercises')
  const directory = path.resolve('qa/v2.1/evidence/licensed-motion-captures')
  fs.mkdirSync(directory, { recursive: true })
  const results = []
  for (const media of EXERCISE_MEDIA_REGISTRY) {
    const exercise = exercises.find(item => item.id === media.exerciseId)
    expect(exercise, media.exerciseId).toBeTruthy()
    await page.getByRole('searchbox', { name: 'Buscar ejercicio' }).fill(exercise!.name)
    await page.locator('.training-catalog-card--button').filter({ has: page.getByRole('heading', { name: exercise!.name, exact: true }) }).click()
    const dialog = page.getByRole('dialog')
    const asset = dialog.locator('picture img')
    await expect(asset).toBeVisible()
    await expect.poll(() => asset.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true)
    await asset.screenshot({ path: path.join(directory, `${exercise!.id}-primary.png`) })
    await dialog.getByRole('button', { name: 'Ver movimiento', exact: true }).click()
    const svg = dialog.locator('.exercise-motion-scene svg, .exercise-motion-scene canvas')
    const isPaused = () => svg.evaluate(node => node instanceof SVGSVGElement ? node.animationsPaused() : (node as HTMLElement).dataset.animationPaused === 'true')
    await expect(svg).toBeVisible()
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await expect.poll(() => page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true)
    await expect.poll(isPaused).toBe(true)
    await svg.evaluate(node => { if (node instanceof SVGSVGElement) node.setCurrentTime(0) })
    await svg.screenshot({ path: path.join(directory, `${exercise!.id}-start.png`) })
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await expect.poll(isPaused).toBe(false)
    const licensed = USER_LICENSED_MEDIA[exercise!.id]
    if (licensed && licensed.durations.length > 1) {
      // Invoke the real pause control in the frame that is being captured. A
      // separate cross-process click can arrive after a short GIF frame ends.
      await page.waitForFunction(peak => {
        const canvas = document.querySelector('[role="dialog"] .exercise-motion-scene canvas') as HTMLCanvasElement | null
        if (canvas?.dataset.frameIndex !== String(peak)) return false
        const pause = [...document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')].find(button => button.textContent === 'Pausar movimiento')
        if (!pause) return false
        pause.click()
        return true
      }, licensed.peakFrame, { polling: 'raf', timeout: 12_000 })
    } else {
      await svg.evaluate(node => { if (node instanceof SVGSVGElement) node.setCurrentTime(1.8) })
      await dialog.getByRole('button', { name: 'Pausar movimiento' }).click()
    }
    await expect.poll(isPaused).toBe(true)
    if (licensed && licensed.durations.length > 1) await expect(svg).toHaveAttribute('data-frame-index', String(licensed.peakFrame))
    await svg.screenshot({ path: path.join(directory, `${exercise!.id}-peak.png`) })
    await context.setOffline(true)
    await dialog.getByRole('button', { name: 'Reanudar movimiento' }).click()
    await expect.poll(isPaused).toBe(false)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await expect.poll(isPaused).toBe(true)
    await dialog.getByRole('button', { name: 'Ver imagen', exact: true }).click()
    await expect.poll(() => asset.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true)
    await context.setOffline(false)
    await dialog.getByRole('button', { name: 'Cerrar', exact: true }).click()
    results.push({ exerciseId: exercise!.id, source: media.source, interaction: 'PASS', visualSpecificity: 'NOT_REVIEWED' })
  }
  expect(results).toHaveLength(33)
  fs.writeFileSync(path.join(directory, 'interaction-results.json'), JSON.stringify(results, null, 2))
})
