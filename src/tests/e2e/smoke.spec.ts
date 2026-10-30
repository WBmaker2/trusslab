import { expect, test } from '@playwright/test'

test('loads without external requests or console errors', async ({ page }) => {
  const external: string[] = []
  const errors: string[] = []
  page.on('request', (request) => {
    const url = request.url()
    if (
      !url.startsWith('http://127.0.0.1:4173') &&
      !url.startsWith('data:') &&
      !url.startsWith('blob:')
    ) {
      external.push(url)
    }
  })
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  await page.goto('/#/design')
  await expect(page.locator('#design-canvas')).toBeVisible()
  await page.waitForTimeout(500)
  expect(external).toEqual([])
  expect(errors).toEqual([])
  await expect(page.locator('.footer-disclaimer')).toContainText('실제 시공 설계')
  await expect(page.locator('.hud-badges')).toContainText('2D 이상화 모델')
})
