import { expect, test } from '@playwright/test'
import { clickWorld, resetToBlank, rowForMember, selectTool } from './helpers'

test.describe('2D editor and solver UI', () => {
  test('builds the worked triangle and reads the hand-calculated forces', async ({ page }) => {
    await resetToBlank(page)

    await selectTool(page, 'node')
    for (const [x, y] of [
      [0, 0],
      [4, 0],
      [2, 3],
    ]) {
      await clickWorld(page, x, y)
    }
    await selectTool(page, 'pin')
    await clickWorld(page, 0, 0)
    await selectTool(page, 'roller')
    await clickWorld(page, 4, 0)
    await selectTool(page, 'load')
    await clickWorld(page, 2, 3)

    await selectTool(page, 'member')
    await clickWorld(page, 0, 0)
    await clickWorld(page, 2, 3)
    await clickWorld(page, 4, 0)
    await clickWorld(page, 2, 3)
    await clickWorld(page, 0, 0)
    await clickWorld(page, 4, 0)

    await expect(page.locator('#stage-status')).toContainText('정정·안정')
    await expect(page.locator('#stage-status')).toContainText('N3 · M3')

    const ac = rowForMember(page, 1)
    const bc = rowForMember(page, 2)
    const ab = rowForMember(page, 3)
    await expect(ac.locator('.type-badge')).toHaveText('C')
    await expect(ac.locator('.col-force .num')).toContainText('300.5')
    await expect(bc.locator('.type-badge')).toHaveText('C')
    await expect(bc.locator('.col-force .num')).toContainText('300.5')
    await expect(ab.locator('.type-badge')).toHaveText('T')
    await expect(ab.locator('.col-force .num')).toContainText('166.7')

    const reactions = await page.locator('#model-live').innerText()
    expect(reactions).toContain('최대 활용률')

    // Delete the bottom chord with the delete tool and confirm instability.
    await selectTool(page, 'delete')
    await clickWorld(page, 2, 0)
    await expect(page.locator('#stage-status')).toContainText('불안정')

    await page.locator('[data-focus-key="undo"]').click()
    await expect(page.locator('#stage-status')).toContainText('정정·안정')

    // Change the diagonal to steel and confirm utilization falls.
    await page.locator('[data-focus-key="row-member-1"]').click()
    const utilBefore = await rowForMember(page, 1).locator('.meter-value').innerText()
    await page.locator('[data-focus-key="member-material-steel"]').click()
    const utilAfter = await rowForMember(page, 1).locator('.meter-value').innerText()
    expect(parseInt(utilBefore, 10)).toBeGreaterThan(100)
    expect(parseInt(utilAfter, 10)).toBeLessThan(50)
  })

  test('places nodes and a member using only the keyboard', async ({ page }) => {
    await resetToBlank(page)
    const canvas = page.locator('#design-canvas')
    await canvas.focus()

    for (let index = 0; index < 4; index += 1) await page.keyboard.press('ArrowLeft')
    for (let index = 0; index < 2; index += 1) await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Enter')
    for (let index = 0; index < 2; index += 1) await page.keyboard.press('ArrowRight')
    await page.keyboard.press('Enter')
    await expect(page.locator('#stage-status')).toContainText('N2')

    await page.keyboard.press('m')
    for (let index = 0; index < 2; index += 1) await page.keyboard.press('ArrowLeft')
    await page.keyboard.press('Enter')
    for (let index = 0; index < 2; index += 1) await page.keyboard.press('ArrowRight')
    await page.keyboard.press('Enter')

    await expect(page.locator('#stage-status')).toContainText('M1')
    await page.locator('.model-list summary').click()
    await expect(page.locator('[data-focus-key="list-member-1"]')).toBeVisible()
  })

  test('renders the 3D bridge and returns to 2D', async ({ page }) => {
    await page.goto('/#/design')
    await page.locator('[data-focus-key="view-3d"]').click()
    await expect(page.locator('#three-host canvas')).toHaveCount(1, { timeout: 6000 })
    await expect(page.locator('.scene-label').first()).toBeVisible({ timeout: 6000 })
    await expect(page.locator('[data-focus-key="three-back-2d"]')).toBeVisible()
    await page.locator('[data-focus-key="view-2d"]').click()
    await expect(page.locator('#design-canvas')).toBeVisible()
  })
})
