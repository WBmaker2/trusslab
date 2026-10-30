import { expect, test } from '@playwright/test'

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' })

  test('skips the load-test animation and shows the static failure', async ({ page }) => {
    await page.goto('/#/teacher')
    await page.locator('[data-focus-key="preset-failed"]').click()
    await page.locator('[data-focus-key="test-cta"]').click()
    await expect(page.getByText('FIRST FAILURE')).toBeVisible({ timeout: 2000 })
    await expect(page.getByText('M5 · 압축 좌굴')).toBeVisible()
    const reduced = await page.evaluate(() =>
      document.querySelector('#app')?.classList.contains('is-reduced-motion'),
    )
    expect(reduced).toBe(true)
  })
})
