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
  await mkdir(path.join(root, '.glyphweave'))
  await writeFile(path.join(root, '.glyphweave/content.html'), '<p>Private draft</p>')
  await writeFile(path.join(root, '.glyphweave/toc.json'), '[]')
  await writeFile(path.join(root, '.glyphweave/manifest.json'), '{}')
  const post = {
    id: 'draft',
    slug: 'draft',
    title: 'Draft',
    description: 'Draft',
    date: '2026-01-01',
    tags: [],
    status: 'draft',
    visibility: 'private',
    language: 'en',
    contentHtmlPath: '.glyphweave/content.html',
    tocPath: '.glyphweave/toc.json',
    manifestPath: '.glyphweave/manifest.json',
    pdfPath: null,
    publicPdfPath: null,
  }
  const save = () =>
    writeFile(
      path.join(root, '.glyphweave/content-index.json'),
      JSON.stringify({ schemaVersion: 1, posts: [post] }),
    )
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
  expect(entries.get('draft')).toMatchObject({ rendered: { html: '<p>Private draft</p>/blog/' } })
})
it('retains the previous store when an artifact escapes the output boundary', async () => {
  const { root, post, save, context, entries } = await fixture()
  await writeFile(path.join(root, 'outside.html'), 'unrelated')
  post.contentHtmlPath = 'outside.html'
  await save()
  await expect(glyphweaveLoader({ rootDir: root }).load(context)).rejects.toThrow('escapes')
  expect([...entries.keys()]).toEqual(['previous'])
})
