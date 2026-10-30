import { afterEach, expect, it } from 'vitest'
import { mkdtemp, mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { buildDocuments, discoverPosts, defaultConfig, type BuildDependencies } from 'glyphweave'

const roots: string[] = []
afterEach(async () => { for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true }) })
async function fixture() {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'glyphweave-documents-')))
  roots.push(root)
  const directory = path.join(root, 'content/typst-posts/draft')
  await mkdir(directory, { recursive: true })
  await writeFile(path.join(directory, 'index.typ'), '= Draft')
  await writeFile(path.join(directory, 'post.yaml'), "title: Draft\nslug: draft\ndescription: Draft document\ndate: '2026-01-01'\nstatus: draft\nvisibility: private\n")
  const config = defaultConfig()
  config.math.strategy = 'mathml'
  const docs = await discoverPosts(root, config)
  const deps: BuildDependencies = {
    typstInfo: async () => ({ binary: 'typst', version: 'typst 0.15.0' }),
    compileHtml: async ({ outputPath }) => {
      await writeFile(outputPath, '<body><p>Draft</p></body>')
      return { outputPath, stdout: '', stderr: '' }
    },
    compilePdf: async () => { throw new Error('Unexpected PDF compilation') },
  }
  return { root, config, docs, deps }
}
it('compiles exactly the host-selected documents without changing their publication metadata', async () => {
  const { root, config, docs, deps } = await fixture()
  const result = await buildDocuments(root, config, async () => docs, deps)
  expect(result.built).toHaveLength(1)
  const index = JSON.parse(await readFile(path.join(root, '.glyphweave/content-index.json'), 'utf8'))
  expect(index.posts[0]).toMatchObject({ status: 'draft', visibility: 'private' })
})
it('rejects duplicate document destinations before invoking the compiler', async () => {
  const { root, config, docs, deps } = await fixture()
  let compiled = false
  deps.compileHtml = async () => { compiled = true; throw new Error('Unexpected compilation') }
  await expect(buildDocuments(root, config, async () => [...docs, ...docs], deps)).rejects.toThrow('duplicate document slug')
  expect(compiled).toBe(false)
})
it('preserves the committed generation if the host selection changes during compilation', async () => {
  const { root, config, docs, deps } = await fixture()
  await buildDocuments(root, config, async () => docs, deps)
  const index = path.join(root, '.glyphweave/content-index.json')
  const previous = await readFile(index, 'utf8')
  let reads = 0
  await expect(buildDocuments(root, config, async () => ++reads === 1 ? docs : [], deps)).rejects.toThrow('Posts changed during build')
  expect(await readFile(index, 'utf8')).toBe(previous)
})
