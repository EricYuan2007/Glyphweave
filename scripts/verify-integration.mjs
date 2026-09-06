import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import { buildAll, defaultConfig } from '../packages/core/dist/index.js'
import { readGlyphweaveContentIndex, readGlyphweavePost } from '../packages/astro/dist/index.js'
const root = await mkdtemp(path.join(os.tmpdir(), 'glyphweave-real-'))
const dir = path.join(root, 'content/typst-posts/demo')
await mkdir(path.join(dir, 'assets'), { recursive: true })
await writeFile(
  path.join(dir, 'assets/diagram.svg'),
  '<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30"><circle cx="15" cy="15" r="12"/></svg>',
)
await writeFile(
  path.join(dir, 'post.yaml'),
  'title: Demo\nslug: demo\ndescription: Demo\ndate: "2026-09-05"\nstatus: published\nvisibility: public\n',
)
await writeFile(path.join(dir, 'included.typ'), 'Included $x + 1$.\n')
await writeFile(
  path.join(dir, 'index.typ'),
  '#image("assets/diagram.svg")\n#link("assets/diagram.svg")[Download diagram]\n// $ignored$\n/* $also_ignored$ */\n= Demo <intro>\nSee #link(<intro>)[intro].\n#include "included.typ"\n#let twice(body) = [#body #body]\n#twice[$y$]\n#datetime.today().display()\n$ cases(x "if" x > 0, -x "otherwise") $\n',
)
for (const strategy of ['mathml', 'svg-frame']) {
  const config = defaultConfig()
  config.math.strategy = strategy
  config.typst.pdf.enabledByDefault = true
  const result = await buildAll(root, config)
  assert.equal(result.cache.compiled, 1)
  const warm = await buildAll(root, config)
  assert.equal(warm.cache.reused, 1)
  const fullConfig = structuredClone(config)
  fullConfig.cache.enabled = false
  const full = await buildAll(root, fullConfig)
  assert.equal(full.cache.compiled, 1)
  for (const getPath of [
    (m) => m.html.rawPath,
    (m) => m.html.contentPath,
    (m) => m.html.tocPath,
    (m) => m.pdf.path,
  ]) {
    assert.deepEqual(
      await readFile(path.join(root, getPath(warm.built[0].manifest))),
      await readFile(path.join(root, getPath(full.built[0].manifest))),
      `Cache/full output mismatch for ${strategy}`,
    )
  }
  assert.equal(warm.built[0].manifest.assets.length, 1)
  assert.deepEqual(
    await readFile(path.join(root, warm.built[0].manifest.assets[0].output)),
    await readFile(path.join(root, full.built[0].manifest.assets[0].output)),
  )
  await buildAll(root, config)
  await writeFile(path.join(dir, 'included.typ'), `Included $x + 1$. Changed ${strategy}.\n`)
  assert.equal((await buildAll(root, config)).cache.compiled, 1)
  const index = await readGlyphweaveContentIndex(root)
  const post = await readGlyphweavePost(root, index.posts[0])
  const count = result.built[0].manifest.capture.math.renderedCount
  if (count !== 4) throw new Error(`Expected 4 rendered formulas, got ${count}`)
  if (!post.contentHtml.includes('href="#intro"')) throw new Error('Broken Typst cross reference')
  if (strategy === 'mathml' && !post.contentHtml.includes('<mtable'))
    throw new Error('Missing cases table')
  if (strategy === 'svg-frame' && !post.contentHtml.includes('<path'))
    throw new Error('Missing SVG paths')
}
console.log(
  'Real Typst comments/includes/macros/references both renderers, incremental invalidation and HTML/PDF byte equivalence passed',
)

await import('./verify-pdf-typography.mjs')
