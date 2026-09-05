import { Buffer } from 'node:buffer'
import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import { buildAll, defaultConfig } from '../packages/core/dist/index.js'
const count = Number(process.argv[2] ?? 10)
if (!Number.isInteger(count) || count < 1 || count > 1000) throw new Error('Count must be 1..1000')
const root = await mkdtemp(path.join(os.tmpdir(), 'glyphweave-benchmark-'))
for (let i = 0; i < count; i++) {
  const dir = path.join(root, 'content/typst-posts', `post-${i}`)
  await mkdir(dir, { recursive: true })
  await writeFile(
    path.join(dir, 'post.yaml'),
    `title: Post ${i}\nslug: post-${i}\ndescription: Benchmark\ndate: "2026-09-05"\nstatus: published\nvisibility: public\n`,
  )
  await writeFile(
    path.join(dir, 'index.typ'),
    '= Benchmark\nInline $x^2+y^2=z^2$.\n$ sum_(i=1)^n i = frac(n(n+1),2) $\n',
  )
}
const runs = []
let expected
for (let run = 0; run < 2; run++) {
  const start = performance.now()
  const result = await buildAll(root, defaultConfig())
  const contents = await Promise.all(
    result.built.map((post) => readFile(path.join(root, post.manifest.html.contentPath), 'utf8')),
  )
  if (expected && JSON.stringify(contents) !== JSON.stringify(expected))
    throw new Error('Non-equivalent rebuild')
  expected = contents
  runs.push({
    milliseconds: Math.round(performance.now() - start),
    posts: result.built.length,
    htmlBytes: contents.reduce((sum, value) => sum + Buffer.byteLength(value), 0),
  })
}
console.log(
  JSON.stringify(
    {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      fixture: '2 formulas per post; no PDF/assets',
      cache: false,
      runs,
      parentPeakRssBytes: process.resourceUsage().maxRSS * 1024,
    },
    null,
    2,
  ),
)
