import { expect, test } from '@playwright/test'

test('article math, navigation and keyboard lightbox work without overflow', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/posts/hnsw-search-notes/')
  await expect(page.locator('math')).toHaveCount(11)
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  ).toBe(true)
  const ids = await page.locator('[id]').evaluateAll((nodes) => nodes.map((node) => node.id))
  expect(new Set(ids).size).toBe(ids.length)
  const broken = await page
    .locator('a[href^="#"]')
    .evaluateAll((nodes) =>
      nodes
        .map((node) => node.getAttribute('href')!)
        .filter(
          (href) => href.length > 1 && !document.getElementById(decodeURIComponent(href.slice(1))),
        ),
    )
  expect(broken).toEqual([])
  const image = page.locator('.glyphweave-content figure > img').first()
  if (await image.count()) {
    await image.focus()
    await page.keyboard.press('Enter')
    await expect(page.locator('dialog')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.locator('dialog')).not.toBeVisible()
    await expect(image).toBeFocused()
  }
  expect(errors).toEqual([])
})

test('search returns a published article', async ({ page }) => {
  await page.goto('/search/')
  await page.getByLabel('Search query').fill('HNSW')
  await page.locator('#article-search button').click()
  await expect(page.locator('#search-results a').first()).toBeVisible()
})
