import { expect, type Page } from '@playwright/test'

export async function resetToBlank(page: Page): Promise<void> {
  await page.goto('/#/design')
  await page.evaluate(() => window.localStorage.clear())
  await page.reload()
  await page.locator('[data-focus-key="reset-model"]').click()
  await page.getByRole('button', { name: '비우기' }).click()
  await expect(page.locator('#stage-status')).toContainText('비어 있음')
}

export async function canvasPoint(
  page: Page,
  x: number,
  y: number,
): Promise<{ x: number; y: number }> {
  const canvas = page.locator('#design-canvas')
  const box = await canvas.boundingBox()
  if (!box) throw new Error('Canvas is not visible')
  const data = await canvas.evaluate((element) => ({ ...(element as HTMLElement).dataset }))
  const scale = Number(data.scale) * Number(data.zoom)
  return {
    x: box.x + Number(data.originX) + Number(data.panX) + x * scale,
    y: box.y + Number(data.originY) + Number(data.panY) - y * scale,
  }
}

export async function clickWorld(page: Page, x: number, y: number): Promise<void> {
  const point = await canvasPoint(page, x, y)
  await page.mouse.click(point.x, point.y)
  await page.waitForTimeout(80)
}

export async function selectTool(page: Page, tool: string): Promise<void> {
  await page.locator(`[data-focus-key="tool-${tool}"]`).click()
}

export function rowForMember(page: Page, memberId: number) {
  return page.locator(`tr[data-member-id="${memberId}"]`)
}

export async function waitForDialog(page: Page, selector = 'dialog[open]') {
  const dialog = page.locator(selector)
  await expect(dialog).toBeVisible({ timeout: 4000 })
  return dialog
}

export async function tabTo(
  page: Page,
  target: string,
  direction: 'forward' | 'backward' = 'forward',
  maxTabs = 160,
): Promise<void> {
  const key = direction === 'forward' ? 'Tab' : 'Shift+Tab'
  for (let index = 0; index < maxTabs; index += 1) {
    await page.keyboard.press(key)
    const active = await page.evaluate(() => {
      const element = document.activeElement as HTMLElement | null
      return {
        id: element?.id ?? '',
        key: element?.getAttribute('data-focus-key') ?? '',
      }
    })
    if (active.id === target || active.key === target) return
  }
  throw new Error(`Could not reach ${target} with ${key}`)
}
