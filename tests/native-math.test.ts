import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import opentype from 'opentype.js'
import { describe, it, expect, vi } from 'vitest'
import { renderMathLayout } from '@glyphweave/math-renderer'
import { adaptTypstHtml } from '@glyphweave/html-adapter'
import { defaultConfig } from '@glyphweave/schema'

const sample = () => ({
  version: 2,
  compiler: 'typst-0.15.1',
  fonts: [],
  glyphs: [
    {
      key: 'test-outline',
      commands: [
        { op: 'M', x: 0, y: -1200 },
        { op: 'L', x: 500, y: 700 },
        { op: 'L', x: 1000, y: -1200 },
        { op: 'Z' },
      ],
    },
  ],
  frames: [
    {
      id: 'gw-frame-0',
      width: 12,
      height: 20,
      baseline: 14,
      em: 10,
      text: 'x < y',
      semantics: { source: '$ x < y $', math: {tag: 'math', attrs: {}, children: [{tag:'mi', attrs:{}, children:['x']}]}, alt: 'x < y', lang: 'en' },
      items: [
        { kind: 'glyph', glyph: 0, x: 2, y: 14, size: 10, color: '#000000' },
        { kind: 'rect', x: 0, y: 8, width: 12, height: 0.5, color: '#000000' },
      ],
    },
  ],
})

describe('native Typst HTML renderer', () => {
  it('preserves measured baseline, fraction rule and glyph position without a browser layout engine', () => {
    const r = renderMathLayout(sample(), './math.otf')
    expect(r.css).toContain('width:1.2em;height:2em;vertical-align:-0.6em')
    expect(r.css).toContain('left:0.2em;top:1.4em')
    expect(r.css).toContain('top:0.8em;width:1.2em;height:0.05em')
    expect(r.frames.get('gw-frame-0')).toContain('aria-label="x &lt; y"')
    expect(r.frames.get('gw-frame-0')).not.toMatch(/<(svg|canvas|script)\b/)
  })
  it('keeps one semantic formula and rejects executable or non-math markup', () => {
    const r = renderMathLayout(sample(), './math.otf')
    const html = r.frames.get('gw-frame-0')!
    expect(html.match(/<math/g)).toHaveLength(1)
    expect(html).toContain('gw-layout-ink" aria-hidden="true"')
    expect(html).toContain('<math aria-label="x &lt; y">')
    expect(html).not.toContain('role="math"')
    const bad = sample()
    bad.frames[0]!.semantics.math.tag = 'script'
    expect(() => renderMathLayout(bad, './math.otf')).toThrow(/semantics/)
    bad.frames[0]!.semantics.math.tag = 'math'
    Object.assign(bad.frames[0]!.semantics.math.attrs, {onclick: 'alert(1)'})
    expect(() => renderMathLayout(bad, './math.otf')).toThrow(/semantics/)
  })
  it('escapes selectable source without exposing internal glyphs or duplicate accessible math', () => {
    const layout = sample()
    layout.frames[0]!.semantics.source = '$ "</span><script>bad</script>" $'
    const result = renderMathLayout(layout, './math.otf')
    const html = result.frames.get('gw-frame-0')!
    expect(html).toContain('data-gw-typst-source="$ &quot;&lt;/span&gt;')
    expect(html).not.toContain('<script>')
    expect(html.match(/<math/g)).toHaveLength(1)
    expect(html).toContain('class="gw-layout-source" aria-hidden="true"')
    expect(result.css).toContain('user-select:all')
  })
  it('writes explicit symmetric font metrics, including deep stretchy glyphs', () => {
    const r = renderMathLayout(sample(), './math.otf')
    const f = opentype.parse(
      r.font.buffer.slice(r.font.byteOffset, r.font.byteOffset + r.font.byteLength) as ArrayBuffer,
    )
    expect(f.ascender).toBe(1200)
    expect(f.descender).toBe(-1200)
    expect(f.tables.os2.sTypoAscender).toBe(1200)
    expect(f.tables.os2.sTypoDescender).toBe(-1200)
    expect(f.charToGlyphIndex('\ue000')).toBe(1)
  })
  it('rejects invalid geometry, duplicate frames and unresolved glyphs', () => {
    const bad = sample()
    bad.frames[0]!.width = NaN
    expect(() => renderMathLayout(bad, './math.otf')).toThrow()
    const duplicate = sample()
    duplicate.frames.push(duplicate.frames[0]!)
    expect(() => renderMathLayout(duplicate, './math.otf')).toThrow(/Duplicate/)
    const missing = sample()
    missing.frames[0]!.items[0]!.glyph = 100
    expect(() => renderMathLayout(missing, './math.otf')).toThrow(/Missing glyph/)
    expect(() => renderMathLayout(sample(), 'javascript:evil.otf')).toThrow(/Unsafe/)
  })
  it('is deterministic and changes asset identity when layout changes', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2020-01-01'))
    const a = renderMathLayout(sample(), './math.otf')
    vi.setSystemTime(new Date('2030-01-01'))
    const b = renderMathLayout(sample(), './math.otf')
    vi.useRealTimers()
    expect(a.font).toEqual(b.font)
    expect(a.css).toEqual(b.css)
    const changed = sample()
    changed.frames[0]!.items[0]!.x = 3
    expect(renderMathLayout(changed, './math.otf').digest).not.toBe(a.digest)
  })
  it('inserts only validated compiler frames after sanitation and exports font/style assets', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'gw-native-'))
    const rawHtmlPath = path.join(root, 'raw.html'),
      sourcePath = path.join(root, 'index.typ')
    await writeFile(sourcePath, '$ x $')
    await writeFile(
      rawHtmlPath,
      '<body><script>alert(1)</script><div data-gw-math="block"><span data-gw-layout="gw-frame-0"></span></div></body>',
    )
    await writeFile(rawHtmlPath + '.layout.json', JSON.stringify(sample()))
    const config = defaultConfig()
    config.math.strategy = 'html-frame'
    const result = await adaptTypstHtml({
      rawHtmlPath,
      post: { metadata: { slug: 'math' }, sourcePath, postDir: root },
      outputDir: root,
      publicBasePath: '/docs/posts',
      options: config.html,
      math: config.math,
    })
    expect(result.contentHtml).not.toContain('<script')
    expect(result.contentHtml).toContain('data-gw-renderer="typst-frame-html"')
    expect(result.contentHtml).toContain('rel="stylesheet"')
    expect(result.rewrittenAssets).toHaveLength(3)
    expect(result.capture.math.typstFrameHtml).toBe(1)
    expect(result.capture.math.renderedCount).toBe(1)
    const css = result.rewrittenAssets.find((a) => a.output.endsWith('.css'))!
    expect(await readFile(css.output, 'utf8')).toContain('@font-face')
    await writeFile(rawHtmlPath, '<body><span data-gw-layout="gw-frame-0"></span></body>')
    await expect(
      adaptTypstHtml({
        rawHtmlPath,
        post: { metadata: { slug: 'math' }, sourcePath, postDir: root },
        outputDir: root,
        publicBasePath: '/docs/posts',
        options: config.html,
        math: config.math,
      }),
    ).rejects.toThrow(/placeholder/)
  })
})
