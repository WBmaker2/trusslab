import { expect, test } from '@playwright/test'

const viewports = [
  { width: 1440, height: 900, mobile: false },
  { width: 1024, height: 768, mobile: false },
  { width: 768, height: 1024, mobile: true },
  { width: 390, height: 844, mobile: true },
]

test.describe('responsive layout', () => {
  for (const viewport of viewports) {
    test(`design fits ${viewport.width}px without horizontal overflow`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await page.goto('/#/design')
      await expect(page.locator('#design-canvas')).toBeVisible()
      await page.waitForTimeout(250)
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      )
      expect(overflow).toBeLessThanOrEqual(1)
      const tabs = page.locator('#mobile-tabs')
      if (viewport.mobile) {
        await expect(tabs).toBeVisible()
      } else {
        await expect(tabs).toBeHidden()
      }
      await page.screenshot({
        path: testInfo.outputPath(`design-${viewport.width}.png`),
        fullPage: false,
      })
    })
  }

  test('mobile tabs switch between build, forces, and mission panels', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/#/design')
    await expect(page.locator('#panel-left')).toBeVisible()
    await expect(page.locator('#panel-right')).toBeHidden()

    await page.locator('[data-focus-key="mobile-tab-forces"]').click()
    await expect(page.locator('#panel-right')).toBeVisible()
    await expect(page.locator('#panel-left')).toBeHidden()
    await expect(page.locator('tr[data-member-id]')).toHaveCount(7)

    await page.locator('[data-focus-key="mobile-tab-mission"]').click()
    await expect(page.locator('#panel-left')).toBeVisible()
    await expect(page.getByText('미션으로 배우기')).toBeVisible()
    await expect(page.getByText('TOOLS')).toBeHidden()
  })
})
