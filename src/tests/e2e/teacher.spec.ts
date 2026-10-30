import { expect, test } from '@playwright/test'

test.describe('teacher tools', () => {
  test('reveals answers, resets progress, and exposes the printable worksheet', async ({
    page,
  }) => {
    await page.goto('/#/teacher')
    await expect(page.getByText('0 / 6 미션 완료')).toBeVisible()

    await page.locator('[data-focus-key="teacher-toggle-answers"]').click()
    await expect(page.getByText('대각선이 없어 각도가 자유롭게 변할 수 있다')).toBeVisible()
    await expect(page.getByText('정답 표시 중').first()).toBeVisible()

    await page.locator('[data-focus-key="teacher-reset"]').click()
    await page.getByRole('button', { name: '모두 지우기' }).click()
    await expect(page.getByText('0 / 6 미션 완료')).toBeVisible()
    await expect(page.getByText('정답 숨김').first()).toBeVisible()
    const stored = await page.evaluate(() => window.localStorage.getItem('trusslab.progress.v1'))
    expect(stored).toBeNull()

    await page.emulateMedia({ media: 'print' })
    await expect(page.locator('#worksheet')).toBeVisible()
    await expect(page.locator('#app')).toBeHidden()
    await expect(page.locator('#worksheet')).toContainText('트러스 설계 활동지')
  })
})
