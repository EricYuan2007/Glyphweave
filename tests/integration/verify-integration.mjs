import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import {
  buildAll,
  defaultConfig,
  prepareNativeEngine,
} from '../../packages/glyphweave/dist/build/index.js'
import { openGlyphweaveSnapshot } from '../../packages/glyphweave/dist/artifacts/index.js'
// Integration fixtures live outside the workspace; prepare their engine explicitly.
const nativeEngine = await prepareNativeEngine('glyphweave-typst-html', process.cwd())
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
for (const strategy of ['mathml', 'svg-frame', 'html-frame']) {
  const config = defaultConfig()
  config.math.strategy = strategy
  config.math.html.binary = nativeEngine
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
  assert.equal(warm.built[0].manifest.assets.length, strategy === 'html-frame' ? 4 : 1)
  assert.deepEqual(
    await readFile(path.join(root, warm.built[0].manifest.assets[0].output)),
    await readFile(path.join(root, full.built[0].manifest.assets[0].output)),
  )
  await buildAll(root, config)
  await writeFile(path.join(dir, 'included.typ'), `Included $x + 1$. Changed ${strategy}.\n`)
  assert.equal((await buildAll(root, config)).cache.compiled, 1)
  const snapshot = await openGlyphweaveSnapshot(root)
  const post = snapshot.readPost(snapshot.index.posts[0].id)
  const count = result.built[0].manifest.capture.math.renderedCount
  if (count !== 4) throw new Error(`Expected 4 rendered formulas, got ${count}`)
  if (!post.contentHtml.includes('href="#intro"')) throw new Error('Broken Typst cross reference')
  if (strategy === 'html-frame') {
    const layout = JSON.parse(
      await readFile(
        path.join(root, result.built[0].manifest.html.rawPath) + '.layout.json',
        'utf8',
      ),
    )
    assert.deepEqual(
      layout.frames.map((frame) => frame.semantics.source),
      ['$x + 1$', '$y$', '$y$', '$ cases(x "if" x > 0, -x "otherwise") $'],
    )
  }
  if (strategy === 'mathml' && !post.contentHtml.includes('<mtable'))
    throw new Error('Missing cases table')
  if (strategy === 'svg-frame' && !post.contentHtml.includes('<path'))
    throw new Error('Missing SVG paths')
}
console.log(
  'Real Typst comments/includes/macros/references all three renderers, incremental invalidation and HTML/PDF byte equivalence passed',
)

await import('./verify-pdf-typography.mjs')
