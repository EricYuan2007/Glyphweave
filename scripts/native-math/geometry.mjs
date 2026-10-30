import path from 'node:path'
import { pathToFileURL } from 'node:url'
/* global URL, document, getComputedStyle */
import fs from 'node:fs/promises'
import assert from 'node:assert/strict'
import { chromium, firefox, webkit } from '@playwright/test'
const root = pathToFileURL(path.resolve('test-results/native-math') + path.sep)
const layout = JSON.parse(await fs.readFile(new URL('raw.html.layout.json', root), 'utf8'))
const results = []
for (const [name, engine] of Object.entries({ chromium, firefox, webkit })) {
  const browser = await engine.launch()
  for (const width of [1100, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } })
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    page.on('requestfailed', (r) => errors.push(r.url()))
    await page.goto(new URL('gallery.html', root).href)
    await page.evaluate(() => document.fonts.ready)
    const measurements = await page.locator('[data-gw-accessible-math]').evaluateAll((nodes) =>
      nodes.map((n) => {
        const r = n.getBoundingClientRect()
        const em = parseFloat(getComputedStyle(n).fontSize)
        return {
          width: r.width,
          height: r.height,
          em,
          glyphs: [...n.querySelectorAll('.gw-layout-glyph')].map((g) => {
            const marker = document.createElement('i')
            marker.style = 'display:inline-block;width:0;height:0'
            g.append(marker)
            const baseline = marker.getBoundingClientRect().top - r.top
            marker.remove()
            return { x: g.getBoundingClientRect().left - r.left, baseline }
          }),
        }
      }),
    )
    assert.deepEqual(errors, [])
    assert.equal(
      await page.locator('.gw-layout-ink svg,.gw-layout-ink math,.gw-layout-ink canvas').count(),
      0,
    )
    assert(measurements.every((m) => m.width > 0 && m.height > 0))
    assert.equal(measurements.length, 50)
    let worstBaseline = 0,
      worstPosition = 0,
      worstDimension = 0,
      glyphCount = 0
    for (let i = 0; i < 50; i++) {
      let actual = measurements[i],
        frame = layout.frames[i],
        scale = actual.em / frame.em
      worstDimension = Math.max(
        worstDimension,
        Math.abs(actual.width - frame.width * scale),
        Math.abs(actual.height - frame.height * scale),
      )
      let glyphs = frame.items.filter((x) => x.kind === 'glyph')
      assert.equal(actual.glyphs.length, glyphs.length)
      glyphs.forEach((g, j) => {
        worstBaseline = Math.max(worstBaseline, Math.abs(actual.glyphs[j].baseline - g.y * scale))
        worstPosition = Math.max(worstPosition, Math.abs(actual.glyphs[j].x - g.x * scale))
        glyphCount++
      })
    }
    assert(worstDimension < 0.05)
    assert(worstPosition < 0.05)
    assert(worstBaseline < 0.05)
    results.push({ name, width, glyphCount, worstBaseline, worstPosition, worstDimension })
    await page.close()
  }
  await browser.close()
}
await fs.writeFile(new URL('geometry.json', root), JSON.stringify(results, null, 2))
console.log(results)
