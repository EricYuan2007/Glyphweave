import { expect, test } from '@playwright/test'

test('native equations retain exact selectable Typst source', async ({ page }) => {
  await page.goto('/posts/hnsw-search-notes/')
  const source = page.locator('.gw-layout-source').first()
  await expect(source).toBeVisible()
  const copied = await source.evaluate(node => {
    const text = node.firstChild!
    const range = document.createRange()
    range.setStart(text, 1)
    range.setEnd(text, Math.min(3, text.textContent!.length))
    const selection = getSelection()!
    selection.removeAllRanges()
    selection.addRange(range)
    const data = new DataTransfer()
    const event = new ClipboardEvent('copy', { bubbles: true, cancelable: true, clipboardData: data })
    node.dispatchEvent(event)
    return { text: event.clipboardData!.getData('text/plain'), expected: node.getAttribute('data-gw-typst-source'), handled: event.defaultPrevented }
  })
  expect(copied.handled).toBe(true)
  expect(copied.text).toBe(copied.expected)
  expect(copied.text).toMatch(/^\$[\s\S]+\$$/)
  expect(copied.text).not.toMatch(/[\uE000-\uF8FF]/)
  await expect(page.locator('.gw-math-selected')).toHaveCount(1)
})

test('copying prose with equations preserves text and replaces only formula content', async ({ page }) => {
  await page.goto('/posts/hnsw-search-notes/')
  const result = await page.locator('p').filter({ has: page.locator('.gw-layout-source') }).first().evaluate(p => {
    const expected = p.cloneNode(true) as HTMLElement
    expected.querySelectorAll('.gw-layout-ink, .gw-layout-semantics').forEach(n => n.remove())
    const range = document.createRange()
    range.selectNodeContents(p)
    getSelection()!.removeAllRanges()
    getSelection()!.addRange(range)
    const data = new DataTransfer()
    const event = new ClipboardEvent('copy', { bubbles: true, cancelable: true, clipboardData: data })
    p.dispatchEvent(event)
    return { text: event.clipboardData!.getData('text/plain'), expected: expected.textContent }
  })
  expect(result.text).toBe(result.expected)
  expect(result.text).not.toMatch(/[\uE000-\uF8FF]/)
})

test('real pointer selection and keyboard copy put Typst on the clipboard', async ({ page, context }, info) => {
  test.skip(info.project.name !== 'chromium', 'Clipboard read permission is Chromium-specific')
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('/posts/hnsw-search-notes/')
  const source = page.locator('.gw-layout-source').first()
  await source.scrollIntoViewIfNeeded()
  const box = (await source.boundingBox())!
  await page.mouse.move(box.x + 1, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width - 1, box.y + box.height / 2, { steps: 8 })
  await page.mouse.up()
  await expect(page.locator('.gw-math-selected')).toHaveCount(1)
  await page.keyboard.press('ControlOrMeta+c')
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(await source.getAttribute('data-gw-typst-source'))
})
