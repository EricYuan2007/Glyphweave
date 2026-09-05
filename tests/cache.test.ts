import { mkdtemp, mkdir, writeFile, readFile, rm, stat, utimes, symlink } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { buildAll, resolvePostOutputDir, type BuildDependencies } from '@glyphweave/core'
import { defaultConfig } from '@glyphweave/schema'

const roots: string[] = []
afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true })
})
async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'glyphweave-cache-'))
  roots.push(root)
  const dirs = ['one', 'two'].map((slug) => path.join(root, 'content/typst-posts', slug))
  for (const [i, dir] of dirs.entries()) {
    await mkdir(dir, { recursive: true })
    await writeFile(
      path.join(dir, 'post.yaml'),
      `title: Test\nslug: ${i === 0 ? 'one' : 'two'}\ndescription: Test\ndate: "2026-09-05"\nstatus: published\nvisibility: public\npdf: true\n`,
    )
    await writeFile(path.join(dir, 'index.typ'), '= Test')
  }
  let identity = 'compiler-1'
  let failPdf = false
  let mutate: (() => Promise<void>) | undefined
  const deps: BuildDependencies = {
    cacheIdentity: async () => identity,
    typstInfo: async () => ({ binary: 'typst', version: 'typst 0.15.0' }),
    compileHtml: async ({ outputPath, creationTimestamp }) => {
      expect(creationTimestamp).toBe(1788566400)
      await writeFile(outputPath, '<body><h1>Test</h1><p>Body</p></body>')
      await mutate?.()
      return { outputPath, stdout: '', stderr: '' }
    },
    compilePdf: async ({ outputPath }) => {
      if (failPdf) throw new Error('PDF failure')
      await writeFile(outputPath, '%PDF-test')
      return { outputPath, stdout: '', stderr: '' }
    },
  }
  const config = defaultConfig()
  return {
    root,
    dirs,
    config,
    deps,
    run: () => buildAll(root, config, deps),
    changeCompiler: () => {
      identity += 'x'
    },
    failPdf: () => {
      failPdf = true
    },
    mutate: (fn: () => Promise<void>) => {
      mutate = fn
    },
  }
}

describe('transactional incremental cache', () => {
  it('reuses complete artifacts and forces a byte-equivalent rebuild', async () => {
    const f = await fixture()
    expect((await f.run()).cache).toMatchObject({ compiled: 2, reused: 0 })
    const first = await resolvePostOutputDir(f.root, f.config, 'one')
    const warm = await f.run()
    expect(warm.cache).toMatchObject({ compiled: 0, reused: 2 })
    const second = await resolvePostOutputDir(f.root, f.config, 'one')
    expect(second).not.toBe(first)
    f.config.cache.enabled = false
    expect((await f.run()).cache).toMatchObject({ compiled: 2, reused: 0 })
    const third = await resolvePostOutputDir(f.root, f.config, 'one')
    for (const name of ['raw.html', 'content.html', 'toc.json', 'article.pdf']) {
      expect(await readFile(path.join(second, name))).toEqual(
        await readFile(path.join(third, name)),
      )
    }
  })
  it.each(['index.typ', 'included.typ', 'asset.svg', 'refs.bib'])(
    'invalidates only the affected article for %s bytes even with preserved mtime',
    async (name) => {
      const f = await fixture()
      const file = path.join(f.dirs[0]!, name)
      await writeFile(file, 'first')
      await f.run()
      const old = await stat(file)
      await writeFile(file, 'other')
      await utimes(file, old.atime, old.mtime)
      expect((await f.run()).cache).toMatchObject({ compiled: 1, reused: 1 })
      await rm(file)
      if (name !== 'index.typ') expect((await f.run()).cache.compiled).toBe(1)
    },
  )
  it('invalidates config, compiler and lockfile changes', async () => {
    const f = await fixture()
    await f.run()
    f.config.math.strategy = 'svg-frame'
    expect((await f.run()).cache.compiled).toBe(2)
    f.changeCompiler()
    expect((await f.run()).cache.compiled).toBe(2)
    await writeFile(path.join(f.root, 'pnpm-lock.yaml'), 'changed')
    expect((await f.run()).cache.compiled).toBe(2)
  })
  it.each(['content.html', 'article.pdf', 'manifest.json'])(
    'recovers from corrupt or missing %s',
    async (name) => {
      const f = await fixture()
      await f.run()
      const dir = await resolvePostOutputDir(f.root, f.config, 'one')
      await writeFile(path.join(dir, name), 'broken')
      expect((await f.run()).cache).toMatchObject({ compiled: 1, reused: 1 })
      await rm(path.join(await resolvePostOutputDir(f.root, f.config, 'one'), name))
      expect((await f.run()).cache.compiled).toBe(1)
    },
  )
  it('does not cache optional PDF failures', async () => {
    const f = await fixture()
    f.config.typst.pdf.failure = 'warn'
    f.failPdf()
    await f.run()
    expect((await f.run()).cache.compiled).toBe(2)
  })
  it('drops deleted and newly private articles', async () => {
    const f = await fixture()
    await f.run()
    await rm(f.dirs[0]!, { recursive: true })
    const metadata = path.join(f.dirs[1]!, 'post.yaml')
    await writeFile(metadata, (await readFile(metadata, 'utf8')).replace('public', 'private'))
    expect((await f.run()).built).toHaveLength(0)
    const index = JSON.parse(
      await readFile(path.join(f.root, '.glyphweave/content-index.json'), 'utf8'),
    )
    expect(index.posts).toEqual([])
  })
  it('preserves the committed index when inputs mutate during compilation', async () => {
    const f = await fixture()
    await f.run()
    const indexPath = path.join(f.root, '.glyphweave/content-index.json')
    const previous = await readFile(indexPath)
    f.changeCompiler()
    f.mutate(() => writeFile(path.join(f.dirs[0]!, 'new.typ'), Math.random().toString()))
    await expect(f.run()).rejects.toThrow('inputs changed during build')
    expect(await readFile(indexPath)).toEqual(previous)
  })
  it('rejects escaped input links and bypasses malformed cache metadata', async () => {
    const f = await fixture()
    await f.run()
    const index = JSON.parse(
      await readFile(path.join(f.root, '.glyphweave/content-index.json'), 'utf8'),
    )
    await writeFile(path.join(f.root, index.cachePath), '{bad')
    expect((await f.run()).cache.compiled).toBe(2)
    await symlink(path.join(f.dirs[1]!, 'index.typ'), path.join(f.dirs[0]!, 'outside.typ'))
    await expect(f.run()).rejects.toThrow('Input link escapes article')
  })
})
