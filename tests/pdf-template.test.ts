import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { defaultConfig } from '@glyphweave/schema'

describe('PDF template', () => {
  it('prefers an editorial Chinese serif stack for body text', () => {
    expect(defaultConfig().typst.pdf.template.fonts.slice(0, 2)).toEqual([
      'Songti SC',
      'STSong',
    ])
  })

  it('defines editorial page furniture and block-specific rhythm', async () => {
    const template = await readFile('packages/typst/prelude/glyphweave-pdf.typ', 'utf-8')

    expect(template).toContain('header: context')
    expect(template).toContain('footer: context')
    expect(template).toContain('show raw.where(block: true)')
    expect(template).toContain('show raw.line:')
    expect(template).toContain('show math.equation.where(block: true)')
    expect(template).toContain('show table:')
    expect(template).toContain('first-line-indent: 0pt')
    expect(template).not.toContain('first-line-indent: (amount:')
    expect(template).toContain('let line-leading = 0.62em')
    expect(template).toContain('let block-spacing = 0.82em')
    expect(template).toContain('spacing: line-leading')
    expect(template).toContain('box(move(dy: 0.04em, it))')
    expect(template).toContain('inset: (x: 6pt, y: 6pt)')
    expect(template).toContain('justification-limits: (')
    expect(template).toContain('sticky: true')
    expect(template).toContain('stroke: (x, y) =>')
  })
})
