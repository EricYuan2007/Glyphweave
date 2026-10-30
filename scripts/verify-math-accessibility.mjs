/* global document, getComputedStyle */
import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { execFileSync } from 'node:child_process'
import { chromium, firefox, webkit } from '@playwright/test'
import { renderMathLayout } from '../packages/glyphweave/dist/math/index.js'
const study = path.resolve('test-results/native-math')
const binary = path.resolve('crates/typst-html/target/release/glyphweave-typst-html')
const output = path.join(study, 'accessibility.html')
execFileSync(binary, [
  path.resolve('tests/fixtures/native-math'),
  path.resolve('tests/fixtures/native-math/accessibility.typ'),
  output,
  '1793145600',
])
const layout = JSON.parse(await readFile(`${output}.layout.json`, 'utf8'))
assert.equal(layout.frames.length, 6)
assert.equal(
  layout.frames[0].semantics.source,
  '#math.equation(half($a+b$), alt: "a 加 b 的和除以二")',
)
assert(
  layout.frames
    .slice(1)
    .every(
      (frame) => frame.semantics.source.startsWith('$') && frame.semantics.source.endsWith('$'),
    ),
)
const rendered = renderMathLayout(layout, './accessibility.otf')
await writeFile(path.join(study, 'accessibility.otf'), rendered.font)
await writeFile(path.join(study, 'accessibility.css'), rendered.css)
let html = await readFile(output, 'utf8')
html = html.replace(/<span data-gw-layout="(gw-frame-\d+)"[^>]*><\/span>/g, (_, id) =>
  rendered.frames.get(id),
)
html = html.replace('</head>', '<link rel="stylesheet" href="accessibility.css"></head>')
await writeFile(output, html)
const results = []
for (const [name, engine] of Object.entries({ chromium, firefox, webkit })) {
  const browser = await engine.launch()
  const page = await browser.newPage()
  await page.goto(pathToFileURL(output).href)
  await page.evaluate(() => document.fonts.ready)
  assert.equal(await page.locator('.gw-layout-semantics > math').count(), 6)
  assert.equal(await page.locator('.gw-layout-semantics[lang=zh]').count(), 6)
  assert.equal(await page.locator('math').first().getAttribute('aria-label'), 'a 加 b 的和除以二')
  assert.equal(await page.locator('math').first().locator('mfrac > mn').textContent(), '2')
  assert.equal(await page.locator('math').first().locator('mfrac mi').count(), 2)
  assert.equal(await page.locator('.gw-layout-ink[aria-hidden=true]').count(), 6)
  assert.equal(await page.locator('[data-gw-accessible-math][aria-label]').count(), 0)
  const references = await page
    .locator('a[href^="#"]')
    .evaluateAll((ns) =>
      ns.map((n) => ({
        text: n.textContent,
        exists: !!document.getElementById(n.getAttribute('href').slice(1)),
      })),
    )
  assert(references.length === 2 && references.every((r) => r.exists))
  assert.match(references[0].text, /1$/)
  assert.match(references[1].text, /2$/)
  const semantics = await page
    .locator('.gw-layout-semantics')
    .evaluateAll((ns) =>
      ns.map((n) => ({
        display: getComputedStyle(n).display,
        visibility: getComputedStyle(n).visibility,
        width: n.getBoundingClientRect().width,
      })),
    )
  assert(
    semantics.every((s) => s.display !== 'none' && s.visibility === 'visible' && s.width === 1),
  )
  if (name === 'chromium') {
    await page.goto(pathToFileURL(path.join(study, 'gallery.html')).href)
    const client = await page.context().newCDPSession(page)
    const { nodes } = await client.send('Accessibility.getFullAXTree')
    const visible = nodes.filter((n) => !n.ignored)
    assert.equal(visible.filter((n) => n.role?.value === 'MathMLMath').length, 50)
    for (const role of ['MathMLFraction', 'MathMLRoot', 'MathMLSup', 'MathMLSub', 'MathMLTable'])
      assert(
        visible.some((n) => n.role?.value === role),
        role,
      )
    assert(
      !visible.some((n) => /[\uE000-\uF8FF]/u.test(n.name?.value ?? '')),
      'Private glyph codes leaked into accessibility tree',
    )
    results.push({ engine: name, mathRoots: 50, structuredAccessibilityTree: true })
  } else results.push({ engine: name, semanticDOM: true })
  await browser.close()
}
await writeFile(path.join(study, 'accessibility-results.json'), JSON.stringify(results, null, 2))
console.log(results)
