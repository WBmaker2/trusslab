import { expect, test } from '@playwright/test'
import { clickWorld, waitForDialog } from './helpers'

test.describe('missions and load tests', () => {
  test('completes the triangle mission with a wrong prediction first', async ({ page }) => {
    await page.goto('/#/missions')
    await page.locator('[data-focus-key="mission-start-triangle-vs-square"]').click()
    await waitForDialog(page)
    await page.locator('label[for="prediction-option-triangle-vs-square-1"]').click()
    await page.getByRole('button', { name: '예측 제출' }).click()
    await expect(page.locator('#prediction-feedback')).toContainText('아직 맞지 않습니다')

    await page.locator('label[for="prediction-option-triangle-vs-square-0"]').click()
    await page.getByRole('button', { name: '예측 제출' }).click()
    await expect(page.locator('dialog[open]')).toHaveCount(0, { timeout: 3000 })
    await expect(page.locator('#stage-status')).toContainText('불안정')

    await clickWorld(page, 0, 0)
    await clickWorld(page, 4, 3)
    await expect(page.locator('#stage-status')).toContainText('정정·안정')
    await expect(page.locator('#stage-status')).toContainText('M5')

    await page.locator('[data-focus-key="mission-test"]').click()
    await waitForDialog(page, 'dialog.dialog-completion')
    await expect(page.locator('dialog.dialog-completion')).toContainText('삼각형은 왜 단단할까?')
    await expect(page.locator('dialog.dialog-completion')).toContainText('삼각형은 변의 길이가')

    await page.getByRole('button', { name: '다음 미션' }).click()
    await waitForDialog(page)
    await expect(page.locator('dialog[open] .dialog-title')).toHaveText('인장과 압축')
  })

  test('finds the first failure in the load ramp', async ({ page }) => {
    await page.goto('/#/teacher')
    await page.locator('[data-focus-key="preset-failed"]').click()
    await page.locator('[data-focus-key="test-cta"]').click()
    await expect(page.getByText('FIRST FAILURE')).toBeVisible({ timeout: 7000 })
    await expect(page.getByText('M5 · 압축 좌굴')).toBeVisible()
    const failedRow = page.locator('tr[data-member-id="5"]')
    await expect(failedRow).toContainText('파괴')
    await expect(page.locator('#stage-status')).toContainText('132%')
  })
})
