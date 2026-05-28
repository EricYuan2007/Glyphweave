import { mkdtemp, readFile, mkdir, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildAll } from '@glyphweave/core'
import { defaultConfig } from '@glyphweave/schema'

describe('build pipeline', () => {
  it('writes content, toc, manifest, and content-index artifacts', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'glyphweave-build-'))
    const postDir = path.join(root, 'content/typst-posts/basic-post')
    await mkdir(postDir, { recursive: true })
    await writeFile(path.join(postDir, 'index.typ'), '= Basic Post\n')
    await writeFile(
      path.join(postDir, 'post.yaml'),
      [
        'title: "Basic Post"',
        'slug: "basic-post"',
        'description: "A basic Typst post."',
        'date: "2026-05-28"',
        'tags: ["Typst", "Web"]',
        'status: "published"',
        'visibility: "public"',
        'pdf: true',
      ].join('\n'),
    )

    const result = await buildAll(root, defaultConfig(), {
      typstInfo: async () => ({ binary: 'typst', version: 'typst 0.14.2' }),
      compileHtml: async ({ outputPath }) => {
        await writeFile(outputPath, '<body><h1>Basic Post</h1><p>Searchable body.</p></body>')
        return { outputPath, stdout: '', stderr: '' }
      },
      compilePdf: async ({ outputPath }) => {
        await writeFile(outputPath, '%PDF fake')
        return { outputPath, stdout: '', stderr: '' }
      },
    })

    expect(result.built).toHaveLength(1)
    const index = JSON.parse(await readFile(path.join(root, '.glyphweave/content-index.json'), 'utf-8'))
    expect(index.posts[0].slug).toBe('basic-post')
    expect(index.posts[0].publicPdfPath).toBe('/glyphweave/posts/basic-post/article.pdf')
    expect(await readFile(path.join(root, '.glyphweave/generated/posts/basic-post/content.html'), 'utf-8')).toContain(
      'Searchable body',
    )
    expect(await readFile(path.join(root, '.glyphweave/generated/posts/basic-post/toc.json'), 'utf-8')).toContain(
      'Basic Post',
    )
    expect(await readFile(path.join(root, '.glyphweave/generated/posts/basic-post/manifest.json'), 'utf-8')).toContain(
      'typst 0.14.2',
    )
  })

  it('writes math capture report and compile diagnostics to the manifest', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'glyphweave-build-math-'))
    const postDir = path.join(root, 'content/typst-posts/math-post')
    await mkdir(postDir, { recursive: true })
    await writeFile(path.join(postDir, 'index.typ'), 'Inline $sum_(i=1)^n x_i^2$ formula.\n')
    await writeFile(
      path.join(postDir, 'post.yaml'),
      [
        'title: "Math Post"',
        'slug: "math-post"',
        'description: "A math Typst post."',
        'date: "2026-05-28"',
        'tags: ["Typst", "Math"]',
        'status: "published"',
        'visibility: "public"',
      ].join('\n'),
    )

    await buildAll(root, defaultConfig(), {
      typstInfo: async () => ({ binary: 'typst', version: 'typst 0.14.2' }),
      compileHtml: async ({ outputPath }) => {
        await writeFile(
          outputPath,
          '<body><p>Inline <span style="display: inline-block"><svg class="typst-frame" viewBox="0 0 10 10" style="overflow: visible; width: 1em; height: 0.8em"><path d="M0 0H10V10Z"></path></svg></span> formula.</p></body>',
        )
        return {
          outputPath,
          stdout: '',
          stderr: 'warning: HTML export is experimental',
          diagnostics: [
            {
              code: 'typst-html-experimental',
              severity: 'info',
              message: 'HTML export is experimental',
            },
          ],
        }
      },
      compilePdf: async ({ outputPath }) => ({ outputPath, stdout: '', stderr: '' }),
    })

    const manifest = JSON.parse(
      await readFile(path.join(root, '.glyphweave/generated/posts/math-post/manifest.json'), 'utf-8'),
    )

    expect(manifest.capture.math.sourceFormulaCount).toBe(1)
    expect(manifest.capture.math.typstFrameSvg).toBe(1)
    expect(manifest.capture.math.sourceFallbacks).toBe(1)
    expect(manifest.capture.math.mismatch).toBe(false)
    expect(manifest.diagnostics).toEqual([
      {
        code: 'typst-html-experimental',
        severity: 'info',
        message: 'HTML export is experimental',
      },
    ])
    expect(manifest.typst.features).toContain('html')
    expect(manifest.typst.preludeVersion).toBe('glyphweave-html-1')
  })

  it('skips private and archived posts in the content index', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'glyphweave-build-skip-'))

    async function writePost(slug: string, status: string, visibility: string) {
      const postDir = path.join(root, 'content/typst-posts', slug)
      await mkdir(postDir, { recursive: true })
      await writeFile(path.join(postDir, 'index.typ'), `= ${slug}\n`)
      await writeFile(
        path.join(postDir, 'post.yaml'),
        [
          `title: "${slug}"`,
          `slug: "${slug}"`,
          'description: "A post."',
          'date: "2026-05-28"',
          `status: "${status}"`,
          `visibility: "${visibility}"`,
        ].join('\n'),
      )
    }

    await writePost('public-post', 'published', 'public')
    await writePost('private-post', 'published', 'private')
    await writePost('archived-post', 'archived', 'public')

    const result = await buildAll(root, defaultConfig(), {
      typstInfo: async () => ({ binary: 'typst', version: 'typst 0.14.2' }),
      compileHtml: async ({ outputPath }) => {
        await writeFile(outputPath, '<body><h1>Post</h1></body>')
        return { outputPath, stdout: '', stderr: '' }
      },
      compilePdf: async ({ outputPath }) => ({ outputPath, stdout: '', stderr: '' }),
    })

    const index = JSON.parse(await readFile(path.join(root, '.glyphweave/content-index.json'), 'utf-8'))
    expect(result.built.map(({ post }) => post.metadata.slug)).toEqual(['public-post'])
    expect(result.skipped.map((post) => post.metadata.slug).sort()).toEqual([
      'archived-post',
      'private-post',
    ])
    expect(index.posts.map((post: { slug: string }) => post.slug)).toEqual(['public-post'])
  })

  it('keeps HTML artifacts when optional PDF generation warns', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'glyphweave-build-pdf-warn-'))
    const postDir = path.join(root, 'content/typst-posts/pdf-warn')
    await mkdir(postDir, { recursive: true })
    await writeFile(path.join(postDir, 'index.typ'), '= PDF Warn\n')
    await writeFile(
      path.join(postDir, 'post.yaml'),
      [
        'title: "PDF Warn"',
        'slug: "pdf-warn"',
        'description: "A post."',
        'date: "2026-05-28"',
        'status: "published"',
        'visibility: "public"',
        'pdf: true',
      ].join('\n'),
    )

    const config = defaultConfig()
    config.typst.pdf.failure = 'warn'

    await buildAll(root, config, {
      typstInfo: async () => ({ binary: 'typst', version: 'typst 0.14.2' }),
      compileHtml: async ({ outputPath }) => {
        await writeFile(outputPath, '<body><h1>PDF Warn</h1></body>')
        return { outputPath, stdout: '', stderr: '' }
      },
      compilePdf: async () => {
        throw new Error('PDF failed')
      },
    })

    const manifest = JSON.parse(
      await readFile(path.join(root, '.glyphweave/generated/posts/pdf-warn/manifest.json'), 'utf-8'),
    )
    const content = await readFile(
      path.join(root, '.glyphweave/generated/posts/pdf-warn/content.html'),
      'utf-8',
    )
    expect(manifest.pdf.enabled).toBe(false)
    expect(content).toContain('PDF Warn')
  })

  it('fails in strict capture mode when source formulas are not rendered', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'glyphweave-build-capture-strict-'))
    const postDir = path.join(root, 'content/typst-posts/missing-math')
    await mkdir(postDir, { recursive: true })
    await writeFile(path.join(postDir, 'index.typ'), 'Missing $sum_(i=1)^n x_i^2$ formula.\n')
    await writeFile(
      path.join(postDir, 'post.yaml'),
      [
        'title: "Missing Math"',
        'slug: "missing-math"',
        'description: "A post with missing math."',
        'date: "2026-05-28"',
        'status: "published"',
        'visibility: "public"',
      ].join('\n'),
    )

    await expect(
      buildAll(root, defaultConfig(), {
        typstInfo: async () => ({ binary: 'typst', version: 'typst 0.14.2' }),
        compileHtml: async ({ outputPath }) => {
          await writeFile(outputPath, '<body><p>Missing formula.</p></body>')
          return { outputPath, stdout: '', stderr: '' }
        },
        compilePdf: async ({ outputPath }) => ({ outputPath, stdout: '', stderr: '' }),
      }),
    ).rejects.toThrow('Strict capture failed')
  })
})
