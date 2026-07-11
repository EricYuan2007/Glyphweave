import { describe, expect, it } from 'vitest'
import { GlyphweaveConfigSchema, PostMetadataSchema } from '@glyphweave/schema'

describe('schemas', () => {
  it('normalizes post metadata defaults', () => {
    const metadata = PostMetadataSchema.parse({
      title: 'HNSW Notes',
      slug: 'hnsw-notes',
      description: 'Notes about HNSW.',
      date: '2026-05-28',
      status: 'published',
      visibility: 'public',
    })

    expect(metadata.tags).toEqual([])
    expect(metadata.language).toBe('zh-CN')
    expect(metadata.pdf).toBe(false)
    expect(metadata.source).toBe('index.typ')
  })

  it('rejects private status values and local absolute cover paths', () => {
    expect(() =>
      PostMetadataSchema.parse({
        title: 'Bad',
        slug: 'bad',
        description: 'Bad post.',
        date: '2026-05-28',
        status: 'pending',
        visibility: 'public',
      }),
    ).toThrow()

    expect(() =>
      PostMetadataSchema.parse({
        title: 'Bad',
        slug: 'bad',
        description: 'Bad post.',
        date: '2026-05-28',
        status: 'published',
        visibility: 'public',
        cover: '/Users/example/private.png',
      }),
    ).toThrow()
  })

  it('provides complete config defaults', () => {
    const config = GlyphweaveConfigSchema.parse({})

    expect(config.content.root).toBe('content/typst-posts')
    expect(config.output.root).toBe('.glyphweave')
    expect(config.output.publicBasePath).toBe('/glyphweave')
    expect(config.html.headingIds).toBe('stable')
    expect(config.math.strategy).toBe('mathml')
    expect(config.math.svg.includeSourceFallback).toBe(true)
    expect(config.math.svg.inlineVerticalShift).toBe('0.08em')
    expect(config.capture.strict).toBe(true)
    expect(config.capture.report).toBe(true)
    expect(config.typst.pdf.template.enabled).toBe(true)
    expect(config.typst.pdf.template.fonts[0]).toBe('MiSans')
    expect(config.typst.pdf.template.fonts).toContain('PingFang SC')
    expect(config.typst.pdf.template.monoFonts[0]).toBe('Menlo')
    expect(config.typst.pdf.template.lang).toBe('zh')
    expect(config.typst.pdf.template.region).toBe('CN')
    expect(config.assets.allowedExtensions).toContain('.png')
  })

  it('rejects Typst 0.14-era math configuration', () => {
    expect(() => GlyphweaveConfigSchema.parse({ math: { strategy: 'hybrid' } })).toThrow()
    expect(() =>
      GlyphweaveConfigSchema.parse({ typst: { wrapper: { injectPrelude: true } } }),
    ).toThrow()
    expect(() =>
      GlyphweaveConfigSchema.parse({ math: { includeSourceFallback: true } }),
    ).toThrow()
  })
})
