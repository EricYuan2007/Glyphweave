import { buildDocuments, discoverPosts, defaultConfig } from 'glyphweave'
import { openGlyphweaveSnapshot } from 'glyphweave/artifacts'
import { afterEach, expect, it, vi } from 'vitest'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { glyphweaveLoader } from '../../packages/astro/src/index.js'
const roots: string[] = []
afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true })
})
async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'glyphweave-loader-'))
  roots.push(root)
  const directory = path.join(root, 'content/typst-posts/draft')
  await mkdir(directory, { recursive: true })
  await writeFile(path.join(directory, 'index.typ'), '= Draft')
  await writeFile(
    path.join(directory, 'post.yaml'),
    'title: Draft\nslug: draft\ndescription: Draft\ndate: "2026-01-01"\nstatus: draft\nvisibility: private\n',
  )
  const config = defaultConfig()
  config.math.strategy = 'mathml'
  await buildDocuments(root, config, () => discoverPosts(root, config), {
    typstInfo: async () => ({ binary: 'typst', version: 'typst 0.15.1' }),
    compileHtml: async ({ outputPath }) => {
      await writeFile(outputPath, '<p>Private draft</p>')
      return { outputPath, stdout: '', stderr: '' }
    },
    compilePdf: async () => {
      throw new Error('Unexpected PDF')
    },
  })
  const snapshot = await openGlyphweaveSnapshot(root)
  const post = snapshot.index.posts[0]
  const save = () =>
    writeFile(path.join(root, '.glyphweave/content-index.json'), JSON.stringify(snapshot.index))
  await save()
  const entries = new Map([['previous', { id: 'previous' }]])
  const context = {
    store: {
      clear: () => entries.clear(),
      set: (entry: { id: string }) => entries.set(entry.id, entry),
    },
    parseData: async ({ data }: { data: unknown }) => data,
    generateDigest: (text: string) => text,
    config: { base: '/blog/' },
    logger: { error: vi.fn() },
  } as unknown as Parameters<ReturnType<typeof glyphweaveLoader>['load']>[0]
  return { root, post, save, entries, context }
}
it('loads exactly the host index, including private drafts, and applies the host transform', async () => {
  const { root, context, entries } = await fixture()
  const transform = vi.fn((post, loaded, base) => ({
    data: post,
    html: loaded.contentHtml + base,
    headings: [],
  }))
  await glyphweaveLoader({ rootDir: root, transform }).load(context)
  expect([...entries.keys()]).toEqual(['draft'])
  expect(transform).toHaveBeenCalledOnce()
  expect(entries.get('draft')).toMatchObject({
    rendered: { html: expect.stringContaining('<p>Private draft</p>') },
  })
})
it('retains the previous store when an artifact escapes the output boundary', async () => {
  const { root, post, save, context, entries } = await fixture()
  await writeFile(path.join(root, 'outside.html'), 'unrelated')
  post.contentHtmlPath = 'outside.html'
  await save()
  await expect(glyphweaveLoader({ rootDir: root }).load(context)).rejects.toThrow('escapes')
  expect([...entries.keys()]).toEqual(['previous'])
})

it('rejects an invalid manifest before replacing the Astro store', async () => {
  const { root, post, context, entries } = await fixture()
  await writeFile(path.join(root, post.manifestPath), '{}')
  await expect(openGlyphweaveSnapshot(root)).rejects.toThrow()
  await expect(glyphweaveLoader({ rootDir: root }).load(context)).rejects.toThrow()
  expect([...entries.keys()]).toEqual(['previous'])
})
