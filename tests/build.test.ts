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
})
