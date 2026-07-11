import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { defaultConfig } from '@glyphweave/schema'

describe('PDF template', () => {
  it('prefers MiSans for body text while retaining a monospace code font', () => {
    expect(defaultConfig().typst.pdf.template.fonts[0]).toBe('MiSans')
    expect(defaultConfig().typst.pdf.template.monoFonts[0]).toBe('Menlo')
  })

  it('defines editorial page furniture and block-specific rhythm', async () => {
    const template = await readFile('packages/typst/prelude/glyphweave-pdf.typ', 'utf-8')

    expect(template).toContain('header: context')
    expect(template).toContain('footer: context')
    expect(template).toContain('show raw.where(block: true)')
    expect(template).toContain('show raw.line:')
    expect(template).toContain('show math.equation.where(block: true)')
    expect(template).toContain('show table:')
    expect(template).toContain('first-line-indent: (amount: 2em, all: true)')
    expect(template).toContain('heading-fonts: (')
    expect(template).toContain('"MiSans"')
    expect(template).toContain('set heading(numbering: "1.1")')
    expect(template).toContain('if it.level > 1')
    expect(template).toContain('levels.slice(1)')
    expect(template).toContain('let heading-size = 13.5pt')
    expect(template).toContain('let line-leading = 0.8em')
    expect(template).toContain('let block-spacing = 1em')
    expect(template).toContain('let heading-spacing = 1.05em')
    expect(template).toContain('above: 1.1em')
    expect(template).toContain('below: 1.1em')
    expect(template).toContain('spacing: line-leading')
    expect(template).toContain('box(move(dy: 0.04em, it))')
    expect(template).toContain('inset: (x: 6pt, y: 5.5pt)')
    expect(template).toContain('justification-limits: (')
    expect(template).toContain('sticky: true')
    expect(template).toContain('stroke: (x, y) =>')
  })
})
