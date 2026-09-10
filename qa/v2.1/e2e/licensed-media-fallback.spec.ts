import { test, expect } from '@playwright/test'
import { openApp, mainNav, segmented } from './helpers'

test.use({ serviceWorkers: 'block' })

test('licensed poster failure uses legacy media; failed sprite uses pausable SVG', async ({ page }) => {
  await page.route('**/media/exercises/user-licensed/**', route => route.abort('failed'))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await openApp(page)
  await mainNav(page, 'Training')
  await segmented(page, 'Secciones de Training', 'Ejercicios')
  for (const name of ['Press banca', 'Open Book']) {
    await page.getByRole('searchbox', { name: 'Buscar ejercicio' }).fill(name)
    await page.locator('.training-catalog-card--button').filter({ has: page.getByRole('heading', { name, exact: true }) }).click()
    const dialog = page.getByRole('dialog')
    const image = dialog.locator('picture img')
    await expect.poll(() => image.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth > 0)).toBe(true)
    await expect(image).not.toHaveAttribute('src', /user-licensed/)
    await dialog.getByRole('button', { name: 'Ver movimiento', exact: true }).click()
    const svg = dialog.locator('.exercise-motion-scene svg')
    await expect(svg).toBeVisible()
    await expect.poll(() => svg.evaluate((node: SVGSVGElement) => node.animationsPaused())).toBe(true)
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await expect.poll(() => svg.evaluate((node: SVGSVGElement) => node.animationsPaused())).toBe(false)
    await dialog.getByRole('button', { name: 'Pausar movimiento' }).click()
    await expect.poll(() => svg.evaluate((node: SVGSVGElement) => node.animationsPaused())).toBe(true)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await dialog.getByRole('button', { name: 'Cerrar', exact: true }).click()
  }
})
