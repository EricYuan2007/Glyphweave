import { describe, expect, it } from 'vitest'
import { parseTypstDiagnostics } from '@glyphweave/typst'
import { defaultConfig, PdfTemplateSchema } from '@glyphweave/schema'

describe('PDF typography configuration', () => {
  it('keeps CJK and Latin roles separate, with readable defaults', () => {
    const template = defaultConfig().typst.pdf.template
    expect(template.profile).toBe('editorial')
    expect(template.fonts[0]).toBe('Songti SC')
    expect(template.latinFonts).toEqual(['Libertinus Serif'])
    expect(template.headingFonts).toContain('Noto Sans CJK SC')
    expect(template.fontSize).toBe(10.5)
  })

  it('resolves portable defaults without overriding explicit font choices', () => {
    const portable = PdfTemplateSchema.parse({ profile: 'portable' })
    expect(portable.fonts).toEqual(['Noto Serif CJK SC'])
    expect(portable.headingFonts).toEqual(['Noto Sans CJK SC'])
    expect(portable.monoFonts).toEqual(['DejaVu Sans Mono'])
    const custom = PdfTemplateSchema.parse({
      profile: 'portable',
      fonts: ['Source Han Serif SC'],
      latinFonts: [],
      headingFonts: ['Source Han Sans SC'],
      monoFonts: ['Custom Mono'],
      fontSize: 11,
    })
    expect(custom.fonts).toEqual(['Source Han Serif SC'])
    expect(custom.latinFonts).toEqual([])
    expect(custom.headingFonts).toEqual(['Source Han Sans SC'])
    expect(custom.monoFonts).toEqual(['Custom Mono'])
    expect(custom.fontSize).toBe(11)
    expect(PdfTemplateSchema.parse(custom)).toEqual(custom)
  })

  it('reports missing fonts once per family', () => {
    expect(
      parseTypstDiagnostics(
        'warning: unknown font family: example\nwarning: unknown font family: example',
      ),
    ).toEqual([
      { code: 'typst-font-missing', severity: 'warning', message: 'unknown font family: example' },
    ])
  })

  it('rejects invalid sizes and unusable required font stacks', () => {
    for (const fontSize of [0, -1, 7, 15, Infinity, NaN]) {
      expect(() => PdfTemplateSchema.parse({ fontSize })).toThrow()
    }
    expect(() => PdfTemplateSchema.parse({ fonts: [] })).toThrow()
    expect(() => PdfTemplateSchema.parse({ headingFonts: ['  '] })).toThrow()
    expect(() => PdfTemplateSchema.parse({ profile: 'unknown' })).toThrow()
  })
})
