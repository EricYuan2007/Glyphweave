import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { adaptTypstHtml } from '@glyphweave/html-adapter'
import type { DiscoveredTypstPost } from '@glyphweave/core'

async function makePost(rawHtml: string, source?: string): Promise<{
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
  await writeFile(
    path.join(postDir, 'index.typ'),
    source ??
      [
        '= Demo',
        '',
        'Inline $q$ after.',
        '',
        'Equation $a + b = c$.',
        '',
        'Subscript $x_1$ and superscript $n^2$.',
      ].join('\n'),
  )
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
    const fixture = await makePost('<body><img src="/Users/example/private.png"></body>')

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

  it('rewrites srcset entries and removes unsafe link protocols', async () => {
    const fixture = await makePost(`<!doctype html>
      <html>
        <body>
          <img srcset="assets/figure.png 1x, assets/figure.png 2x">
          <a href="javascript:alert(1)">bad link</a>
        </body>
      </html>`)

    const output = await adaptTypstHtml({
      rawHtmlPath: fixture.rawHtmlPath,
      post: fixture.post,
      outputDir: fixture.outputDir,
      publicBasePath: '/glyphweave',
      options: { sanitize: true, headingIds: 'stable', scopeClass: 'glyphweave-content' },
    })

    expect(output.contentHtml).toContain(
      'srcset="/glyphweave/posts/demo/assets/figure.png 1x, /glyphweave/posts/demo/assets/figure.png 2x"',
    )
    expect(output.contentHtml).toContain('<a>bad link</a>')
    expect(output.contentHtml).not.toContain('javascript:')
  })

  it('fails when an asset escapes the post assets directory', async () => {
    const fixture = await makePost('<body><img src="../secret.png"></body>')

    await expect(
      adaptTypstHtml({
        rawHtmlPath: fixture.rawHtmlPath,
        post: fixture.post,
        outputDir: fixture.outputDir,
        publicBasePath: '/glyphweave',
        options: { sanitize: true, headingIds: 'stable', scopeClass: 'glyphweave-content' },
      }),
    ).rejects.toThrow('Asset escapes post assets directory')
  })

  it('restores inline equations ignored by Typst HTML export as MathML', async () => {
    const fixture = await makePost(`<!doctype html>
      <html>
        <body>
          <h1>Demo</h1>
          <p>Inline</p>
          <p>after.</p>
          <p>Equation</p>
          <p>.</p>
          <p>Subscript</p>
          <p>and superscript</p>
          <p>.</p>
        </body>
      </html>`)

    const output = await adaptTypstHtml({
      rawHtmlPath: fixture.rawHtmlPath,
      post: fixture.post,
      outputDir: fixture.outputDir,
      publicBasePath: '/glyphweave',
      options: { sanitize: true, headingIds: 'stable', scopeClass: 'glyphweave-content' },
    })

    expect(output.contentHtml).toContain(
      '<p>Inline <math class="gw-math" aria-label="q"><mi>q</mi></math> after.</p>',
    )
    expect(output.contentHtml).toContain(
      '<p>Equation <math class="gw-math" aria-label="a + b = c"><mrow><mi>a</mi><mo>+</mo><mi>b</mi><mo>=</mo><mi>c</mi></mrow></math>.</p>',
    )
    expect(output.contentHtml).toContain(
      '<msub><mi>x</mi><mn>1</mn></msub>',
    )
    expect(output.contentHtml).toContain(
      '<msup><mi>n</mi><mn>2</mn></msup>',
    )
  })

  it('wraps Typst frame SVG math with source fallback and preserves safe SVG attributes', async () => {
    const fixture = await makePost(
      `<!doctype html>
        <html>
          <body>
            <p>Inline <span style="display: inline-block"><svg class="typst-frame" viewBox="0 0 10 10" style="overflow: visible; width: 1em; height: 0.8em"><path d="M0 0H10V10Z"></path></svg></span> formula.</p>
            <svg class="typst-frame" viewBox="0 0 80 20" style="overflow: visible; width: 8em; height: 2em">
              <foreignObject><script>alert(1)</script></foreignObject>
              <path d="M0 0H80V20Z"></path>
            </svg>
          </body>
        </html>`,
      [
        '= Demo',
        '',
        'Inline $sum_(i=1)^n x_i^2$ formula.',
        '',
        '$',
        'cases(',
        '  x if x > 0,',
        '  -x otherwise,',
        ')',
        '$',
      ].join('\n'),
    )

    const output = await adaptTypstHtml({
      rawHtmlPath: fixture.rawHtmlPath,
      post: fixture.post,
      outputDir: fixture.outputDir,
      publicBasePath: '/glyphweave',
      options: { sanitize: true, headingIds: 'stable', scopeClass: 'glyphweave-content' },
    })

    expect(output.contentHtml).toContain('class="gw-math gw-math--inline"')
    expect(output.contentHtml).toContain('style="--gw-math-inline-shift: -0.12em"')
    expect(output.contentHtml).toContain('class="gw-math gw-math--block"')
    expect(output.contentHtml).toContain('data-gw-renderer="typst-frame-svg"')
    expect(output.contentHtml).toContain('aria-label="Formula: sum_(i=1)^n x_i^2"')
    expect(output.contentHtml).toContain('class="gw-sr-only"')
    expect(output.contentHtml).toContain('<svg class="typst-frame" viewBox="0 0 10 10" style=')
    expect(output.contentHtml).not.toContain('<foreignObject')
    expect(output.capture.math.typstFrameSvg).toBe(2)
    expect(output.capture.math.sourceFallbacks).toBe(2)
    expect(output.capture.math.mismatch).toBe(false)
  })
})
