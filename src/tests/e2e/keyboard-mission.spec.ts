import { expect, test } from '@playwright/test'
import { tabTo, waitForDialog } from './helpers'

test('completes the triangle mission with the keyboard only', async ({ page }) => {
  await page.goto('/#/missions')
  await tabTo(page, 'mission-start-triangle-vs-square')
  await page.keyboard.press('Enter')
  await waitForDialog(page)

  // The dialog starts on the close button; Tab reaches the radio group.
  await page.keyboard.press('Tab')
  await page.keyboard.press('Space')
  await page.keyboard.press('Tab')
  await page.keyboard.press('Tab')
  await page.keyboard.press('Enter')
  await expect(page.locator('dialog[open]')).toHaveCount(0, { timeout: 3000 })

  await tabTo(page, 'design-canvas')
  const canvas = page.locator('#design-canvas')
  await expect(canvas).toBeFocused()

  // Cursor starts at (6, 4). Move to A(0,0), start a member, then connect to C(4,3).
  for (let index = 0; index < 6; index += 1) await page.keyboard.press('ArrowLeft')
  for (let index = 0; index < 4; index += 1) await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  for (let index = 0; index < 4; index += 1) await page.keyboard.press('ArrowRight')
  for (let index = 0; index < 3; index += 1) await page.keyboard.press('ArrowUp')
  await page.keyboard.press('Enter')
  await expect(page.locator('#stage-status')).toContainText('정정·안정')
  await expect(page.locator('#stage-status')).toContainText('M5')

  await tabTo(page, 'mission-test', 'backward')
  await page.keyboard.press('Enter')
  await waitForDialog(page, 'dialog.dialog-completion')
  await expect(page.locator('dialog.dialog-completion')).toContainText('잘 했습니다')
})
