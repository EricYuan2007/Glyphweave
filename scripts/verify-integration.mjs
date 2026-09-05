import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { buildAll, defaultConfig } from '../packages/core/dist/index.js'
import { readGlyphweaveContentIndex, readGlyphweavePost } from '../packages/astro/dist/index.js'
const root = await mkdtemp(path.join(os.tmpdir(), 'glyphweave-real-'))
const dir = path.join(root, 'content/typst-posts/demo')
await mkdir(dir, { recursive: true })
await writeFile(
  path.join(dir, 'post.yaml'),
  'title: Demo\nslug: demo\ndescription: Demo\ndate: "2026-09-05"\nstatus: published\nvisibility: public\n',
)
await writeFile(path.join(dir, 'included.typ'), 'Included $x + 1$.\n')
await writeFile(
  path.join(dir, 'index.typ'),
  '// $ignored$\n/* $also_ignored$ */\n= Demo <intro>\nSee #link(<intro>)[intro].\n#include "included.typ"\n#let twice(body) = [#body #body]\n#twice[$y$]\n$ cases(x "if" x > 0, -x "otherwise") $\n',
)
for (const strategy of ['mathml', 'svg-frame']) {
  const config = defaultConfig()
  config.math.strategy = strategy
  const result = await buildAll(root, config)
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
console.log('Real Typst comments/includes/macros/references and both renderers passed')
