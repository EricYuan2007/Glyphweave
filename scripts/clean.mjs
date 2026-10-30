import { rm } from 'node:fs/promises'
import { fileURLToPath, URL } from 'node:url'
import path from 'node:path'
const root = fileURLToPath(new URL('../', import.meta.url))
const args = process.argv.slice(2)
if (args.some((arg) => !['--cache', '--dry-run'].includes(arg)))
  throw new Error('Use --cache and/or --dry-run')
const generated = [
  'dist',
  '.astro',
  'examples/astro-blog/dist',
  'examples/minimal/dist',
  'examples/astro-blog/.astro',
  'examples/minimal/.astro',
  'examples/astro-blog/public/glyphweave',
  'examples/minimal/public/glyphweave',
]
const caches = [
  '.glyphweave',
  'examples/astro-blog/.glyphweave',
  'examples/minimal/.glyphweave',
  'crates/typst-html/target',
  'packages/glyphweave/dist',
  'packages/astro/dist',
  'packages/glyphweave/tsconfig.tsbuildinfo',
  'packages/astro/tsconfig.tsbuildinfo',
]
for (const relative of [...generated, ...(args.includes('--cache') ? caches : [])]) {
  const target = path.resolve(root, relative)
  if (!target.startsWith(root)) throw new Error('Unsafe clean path')
  if (!args.includes('--dry-run')) await rm(target, { recursive: true, force: true })
  console.log(`${args.includes('--dry-run') ? 'Would remove' : 'Removed'} ${relative}`)
}
