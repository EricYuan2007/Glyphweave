import { access, mkdir, mkdtemp, readFile, realpath, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildAll, clean, loadConfig, prepareOutput, resolvePostOutputDir } from '@glyphweave/core'
import { defaultConfig, GlyphweaveConfigSchema } from '@glyphweave/schema'
import {
  exportGlyphweaveAssets,
  publishedPosts,
  readGlyphweaveContentIndex,
} from '@glyphweave/astro'
import { adaptTypstHtml } from '@glyphweave/html-adapter'
import type { CompileInput } from '@glyphweave/typst'

async function fixture() {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'glyphweave-regression-')))
  const postDir = path.join(root, 'content/typst-posts/demo')
  await mkdir(path.join(postDir, 'assets'), { recursive: true })
  await writeFile(path.join(postDir, 'index.typ'), '= Demo\n')
  const metadata = async (extra = '', visibility = 'public', status = 'published') =>
    writeFile(
      path.join(postDir, 'post.yaml'),
      `title: Demo\nslug: demo\ndescription: Demo\ndate: "2026-09-05"\nstatus: ${status}\nvisibility: ${visibility}\n${extra}`,
    )
  await metadata()
  const deps = {
    typstInfo: async () => ({ binary: 'typst', version: 'typst 0.15.0' }),
    compileHtml: async ({ outputPath }: CompileInput) => {
      await writeFile(outputPath, '<h1>Demo</h1>')
      return { outputPath, stdout: '', stderr: '' }
    },
    compilePdf: async ({ outputPath }: CompileInput) => {
      await writeFile(outputPath, 'synthetic PDF')
      return { outputPath, stdout: '', stderr: '' }
    },
  }
  return { root, postDir, metadata, deps }
}

describe('engineering contracts', () => {
  it.each(['.', '..', '/', 'content', 'content/typst-posts', 'src', '.git'])(
    'rejects unsafe clean/build output %s before mutations',
    async (output) => {
      const f = await fixture()
      const config = defaultConfig()
      config.output.root = output
      await expect(buildAll(f.root, config, f.deps)).rejects.toThrow(/Unsafe/)
      await expect(clean(f.root, config)).rejects.toThrow(/Unsafe/)
      expect(await readFile(path.join(f.postDir, 'index.typ'), 'utf8')).toBe('= Demo\n')
    },
  )

  it('rejects symlink output and unowned clean', async () => {
    const f = await fixture()
    await symlink(f.postDir, path.join(f.root, 'linked'))
    const config = defaultConfig()
    config.output.root = 'linked'
    await expect(buildAll(f.root, config, f.deps)).rejects.toThrow(/Unsafe/)
    await mkdir(path.join(f.root, '.glyphweave'))
    await expect(clean(f.root)).rejects.toThrow()
  })

  it('only defaults a missing implicit config', async () => {
    const f = await fixture()
    expect(await loadConfig(f.root)).toEqual(defaultConfig())
    await expect(loadConfig(f.root, 'missing.mjs')).rejects.toThrow('Cannot read config')
    await writeFile(path.join(f.root, 'broken.mjs'), 'import "./missing.mjs"; export default {}')
    await expect(loadConfig(f.root, 'broken.mjs')).rejects.toThrow('Invalid config')
  })

  it('applies PDF defaults, explicit overrides and visible warning diagnostics', async () => {
    const f = await fixture()
    const config = defaultConfig()
    config.typst.pdf.enabledByDefault = true
    expect((await buildAll(f.root, config, f.deps)).built[0].manifest.pdf.enabled).toBe(true)
    await f.metadata('pdf: false')
    expect((await buildAll(f.root, config, f.deps)).built[0].manifest.pdf.enabled).toBe(false)
    await f.metadata('pdf: true')
    config.typst.pdf.failure = 'warn'
    const result = await buildAll(f.root, config, {
      ...f.deps,
      compilePdf: async () => {
        throw new Error('synthetic failure')
      },
    })
    expect(result.built[0].manifest.diagnostics).toContainEqual(
      expect.objectContaining({ code: 'glyphweave-pdf-failed', severity: 'warning' }),
    )
    await expect(
      access(path.join(await resolvePostOutputDir(f.root, config, 'demo'), 'article.pdf')),
    ).rejects.toThrow()
  })

  it.each([
    ['private', 'published'],
    ['public', 'archived'],
    ['public', 'draft'],
  ])('does not export old resources after %s/%s', async (visibility, status) => {
    const f = await fixture()
    await f.metadata('pdf: true')
    await buildAll(f.root, defaultConfig(), f.deps)
    await exportGlyphweaveAssets(f.root, 'public/glyphweave/posts')
    await f.metadata('pdf: true', visibility, status)
    await buildAll(f.root, defaultConfig(), f.deps)
    await exportGlyphweaveAssets(f.root, 'public/glyphweave/posts')
    await expect(
      access(path.join(f.root, 'public/glyphweave/posts/demo/article.pdf')),
    ).rejects.toThrow()
  })

  it('preserves the complete old snapshot after a later build failure', async () => {
    const f = await fixture()
    await f.metadata('pdf: true')
    await buildAll(f.root, defaultConfig(), f.deps)
    const before = await readGlyphweaveContentIndex(f.root)
    await expect(
      buildAll(f.root, defaultConfig(), {
        ...f.deps,
        compilePdf: async () => {
          throw new Error('fail')
        },
      }),
    ).rejects.toThrow('previous index preserved')
    expect(await readGlyphweaveContentIndex(f.root)).toEqual(before)
    expect(await readFile(path.join(f.root, before.posts[0].pdfPath!), 'utf8')).toBe(
      'synthetic PDF',
    )
  })

  it('rejects concurrent writers and never steals an existing lock', async () => {
    const f = await fixture()
    const output = await prepareOutput(f.root, defaultConfig())
    await writeFile(path.join(output, '.build.lock'), 'synthetic lock')
    await expect(buildAll(f.root, defaultConfig(), f.deps)).rejects.toThrow('locked')
    await expect(clean(f.root)).rejects.toThrow('locked')
    expect(await readFile(path.join(output, '.build.lock'), 'utf8')).toBe('synthetic lock')
  })

  it('unlisted posts retain direct routes but do not enter listings', async () => {
    const f = await fixture()
    await f.metadata('', 'unlisted')
    await buildAll(f.root, defaultConfig(), f.deps)
    const index = await readGlyphweaveContentIndex(f.root)
    expect(publishedPosts(index)).toHaveLength(1)
    expect(publishedPosts(index, true)).toHaveLength(0)
  })

  it('rejects unsupported toggles rather than pretending to honor them', () => {
    for (const input of [
      { cache: { enabled: true } },
      { assets: { copy: false } },
      { capture: { report: false } },
      { html: { sanitize: false } },
      { typst: { htmlFeatures: false } },
      { typo: true },
    ]) {
      expect(() => GlyphweaveConfigSchema.parse(input)).toThrow()
    }
  })

  it('keeps literal paths in code, strips obfuscated protocols and fixes ID references', async () => {
    const f = await fixture()
    const result = await buildAll(f.root, defaultConfig(), f.deps)
    const outputDir = await resolvePostOutputDir(f.root, defaultConfig(), 'demo')
    const rawHtmlPath = path.join(outputDir, 'raw.html')
    await writeFile(
      rawHtmlPath,
      '<h2 id="old">A</h2><h2>A</h2><h2>A-2</h2><a href="#old">jump</a><a href="java&#x09;script:alert(1)">bad</a><p>/Users/example</p>',
    )
    const adapted = await adaptTypstHtml({
      rawHtmlPath,
      outputDir,
      post: result.built[0].post,
      publicBasePath: '/glyphweave',
      options: { ...defaultConfig().html, headingIds: 'stable' },
    })
    expect(adapted.toc.map((h) => h.id)).toEqual(['a', 'a-2', 'a-2-2'])
    expect(adapted.contentHtml).toContain('href="#a"')
    expect(adapted.contentHtml).toContain('/Users/example')
    expect(adapted.contentHtml).not.toContain('script:')
  })

  it('rejects assets symlinking outside the declared directory', async () => {
    const f = await fixture()
    const result = await buildAll(f.root, defaultConfig(), f.deps)
    const outputDir = await resolvePostOutputDir(f.root, defaultConfig(), 'demo')
    const rawHtmlPath = path.join(outputDir, 'raw.html')
    await writeFile(path.join(f.root, 'outside.png'), 'synthetic')
    await symlink(path.join(f.root, 'outside.png'), path.join(f.postDir, 'assets', 'link.png'))
    await writeFile(rawHtmlPath, '<img src="assets/link.png">')
    await expect(
      adaptTypstHtml({
        rawHtmlPath,
        outputDir,
        post: result.built[0].post,
        publicBasePath: '/glyphweave',
        options: defaultConfig().html,
      }),
    ).rejects.toThrow('escapes')
  })

  it('rejects corrupt or unknown artifact versions', async () => {
    const f = await fixture()
    await mkdir(path.join(f.root, '.glyphweave'))
    await writeFile(
      path.join(f.root, '.glyphweave/content-index.json'),
      '{"schemaVersion":999,"posts":[]}',
    )
    await expect(readGlyphweaveContentIndex(f.root)).rejects.toThrow()
  })
})
