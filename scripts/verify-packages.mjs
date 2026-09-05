import { mkdtemp, readdir, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const root = process.cwd()
const work = await mkdtemp(path.join(os.tmpdir(), 'glyphweave-packages-'))
const packages = ['schema', 'typst', 'html-adapter', 'core', 'astro', 'cli']
for (const name of packages)
  execFileSync(
    'pnpm',
    ['--dir', path.join(root, 'packages', name), 'pack', '--pack-destination', work],
    { stdio: 'pipe' },
  )
const tarballs = (await readdir(work))
  .filter((name) => name.endsWith('.tgz'))
  .map((name) => path.join(work, name))
await writeFile(path.join(work, 'package.json'), JSON.stringify({ private: true, type: 'module' }))
execFileSync('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', ...tarballs], {
  cwd: work,
  stdio: 'pipe',
})
const binary = path.join(work, 'node_modules/.bin/glyphweave')
execFileSync(binary, ['--version'], { cwd: work, stdio: 'inherit' })
await writeFile(
  path.join(work, 'smoke.mjs'),
  `
import { mkdir, writeFile } from 'node:fs/promises';
import { buildAll, defaultConfig } from '@glyphweave/core';
import { readGlyphweaveContentIndex, exportGlyphweaveAssets } from '@glyphweave/astro';
await mkdir('content/typst-posts/demo', {recursive:true});
await writeFile('content/typst-posts/demo/post.yaml', 'title: Demo\\nslug: demo\\ndescription: Demo\\ndate: "2026-09-05"\\nstatus: published\\nvisibility: public\\npdf: true\\n');
await writeFile('content/typst-posts/demo/index.typ', '= Demo\\nInline $x + y$.\\n');
for (const strategy of ['mathml', 'svg-frame']) {
  const config = defaultConfig(); config.math.strategy = strategy;
  await buildAll(process.cwd(), config);
  const index = await readGlyphweaveContentIndex(process.cwd());
  if (index.posts.length !== 1 || !index.posts[0].pdfPath) throw new Error('Incomplete artifacts');
  await exportGlyphweaveAssets(process.cwd(), 'public/glyphweave/posts');
}
`,
)
execFileSync(process.execPath, ['smoke.mjs'], { cwd: work, stdio: 'inherit' })
console.log(`Standalone package smoke passed: ${work}`)
