import { AxeBuilder } from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

test.describe('accessibility', () => {
  test('design screen has no critical or serious axe violations', async ({ page }) => {
    await page.goto('/#/design')
    await expect(page.locator('#design-canvas')).toBeVisible()
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()
    const blocking = results.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious',
    )
    if (blocking.length > 0) {
      console.log(
        JSON.stringify(
          blocking.map((violation) => ({
            id: violation.id,
            impact: violation.impact,
            help: violation.help,
            nodes: violation.nodes.map((node) => node.target),
          })),
          null,
          2,
        ),
      )
    }
    expect(blocking).toEqual([])
  })

  test('missions page has no critical or serious axe violations', async ({ page }) => {
    await page.goto('/#/missions')
    await expect(page.locator('.mission-grid')).toBeVisible()
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()
    const blocking = results.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious',
    )
    if (blocking.length > 0) {
      console.log(
        JSON.stringify(
          blocking.map((violation) => ({
            id: violation.id,
            impact: violation.impact,
            help: violation.help,
            nodes: violation.nodes.map((node) => node.target),
          })),
          null,
          2,
        ),
      )
    }
    expect(blocking).toEqual([])
  })
})

async function scan(page: import('@playwright/test').Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  const blocking = results.violations.filter(
    (violation) => violation.impact === 'critical' || violation.impact === 'serious',
  )
  if (blocking.length > 0) {
    console.log(
      JSON.stringify(
        blocking.map((violation) => ({
          id: violation.id,
          impact: violation.impact,
          help: violation.help,
          nodes: violation.nodes.map((node) => ({
            target: node.target,
            html: node.html,
            summary: node.failureSummary,
          })),
        })),
        null,
        2,
      ),
    )
  }
  expect(blocking).toEqual([])
}

test.describe('accessibility of other screens', () => {
  test('teacher page', async ({ page }) => {
    await page.goto('/#/teacher')
    await page.locator('[data-focus-key="teacher-toggle-answers"]').click()
    await scan(page)
  })

  test('load test screen with a failure', async ({ page }) => {
    await page.goto('/#/teacher')
    await page.locator('[data-focus-key="preset-failed"]').click()
    await page.locator('[data-focus-key="test-cta"]').click()
    await expect(page.getByText('FIRST FAILURE')).toBeVisible({ timeout: 7000 })
    await scan(page)
  })

  test('3D bridge view', async ({ page }) => {
    await page.goto('/#/design')
    await page.locator('[data-focus-key="view-3d"]').click()
    await expect(page.locator('#three-host canvas')).toHaveCount(1, { timeout: 6000 })
    await scan(page)
  })

  test('mobile tabs and panels', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/#/design')
    await scan(page)
    await page.locator('[data-focus-key="mobile-tab-forces"]').click()
    await scan(page)
    await page.locator('[data-focus-key="mobile-tab-mission"]').click()
    await scan(page)
  })
})
