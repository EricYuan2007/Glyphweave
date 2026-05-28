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
})
