import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { adaptTypstHtml } from '@glyphweave/html-adapter'
import type { DiscoveredTypstPost } from '@glyphweave/core'

async function makePost(rawHtml: string): Promise<{
  root: string
  rawHtmlPath: string
  outputDir: string
  post: DiscoveredTypstPost
}> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'glyphweave-adapter-'))
  const postDir = path.join(root, 'content/typst-posts/demo')
  const outputDir = path.join(root, '.glyphweave/generated/posts/demo')
  await mkdir(path.join(postDir, 'assets'), { recursive: true })
  await mkdir(outputDir, { recursive: true })
  await writeFile(path.join(postDir, 'assets/figure.png'), 'fake image')
  const rawHtmlPath = path.join(outputDir, 'raw.html')
  await writeFile(rawHtmlPath, rawHtml)

  return {
    root,
    rawHtmlPath,
    outputDir,
    post: {
      metadata: {
        title: 'Demo',
        slug: 'demo',
        description: 'Demo post.',
        date: '2026-05-28',
        tags: [],
        status: 'published',
        visibility: 'public',
        language: 'zh-CN',
        pdf: false,
        source: 'index.typ',
        cover: null,
        canonicalUrl: null,
      },
      postDir,
      metadataPath: path.join(postDir, 'post.yaml'),
      sourcePath: path.join(postDir, 'index.typ'),
      assetDir: path.join(postDir, 'assets'),
      sourceHash: 'sha256:source',
      metadataHash: 'sha256:metadata',
    },
  }
}

describe('HTML adapter', () => {
  it('extracts body, normalizes headings, rewrites assets, and sanitizes HTML', async () => {
    const fixture = await makePost(`<!doctype html>
      <html>
        <head><style>body { color: red; }</style></head>
        <body>
          <h1>引言</h1>
          <h2>Search Flow</h2>
          <h2>Search Flow</h2>
          <p><img src="assets/figure.png" onerror="alert(1)"></p>
          <p><a href="https://example.com">external</a></p>
          <script>alert(1)</script>
        </body>
      </html>`)

    const output = await adaptTypstHtml({
      rawHtmlPath: fixture.rawHtmlPath,
      post: fixture.post,
      outputDir: fixture.outputDir,
      publicBasePath: '/glyphweave',
      options: { sanitize: true, headingIds: 'stable', scopeClass: 'glyphweave-content' },
    })

    expect(output.toc).toEqual([
      { depth: 1, title: '引言', id: '引言' },
      { depth: 2, title: 'Search Flow', id: 'search-flow' },
      { depth: 2, title: 'Search Flow', id: 'search-flow-2' },
    ])
    expect(output.contentHtml).toContain('src="/glyphweave/posts/demo/assets/figure.png"')
    expect(output.contentHtml).toContain('rel="noopener noreferrer"')
    expect(output.contentHtml).not.toContain('<script')
    expect(output.contentHtml).not.toContain('onerror')
    expect(await readFile(path.join(fixture.outputDir, 'assets/figure.png'), 'utf-8')).toBe(
      'fake image',
    )
  })

  it('fails on local absolute paths', async () => {
    const fixture = await makePost('<body><img src="/Users/eric/private.png"></body>')

    await expect(
      adaptTypstHtml({
        rawHtmlPath: fixture.rawHtmlPath,
        post: fixture.post,
        outputDir: fixture.outputDir,
        publicBasePath: '/glyphweave',
        options: { sanitize: true, headingIds: 'stable', scopeClass: 'glyphweave-content' },
      }),
    ).rejects.toThrow('Local absolute path detected')
  })
})
