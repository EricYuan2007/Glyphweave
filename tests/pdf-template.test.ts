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
    expect(template).toContain('first-line-indent: (')
    expect(template).toContain('justification-limits: (')
    expect(template).toContain('sticky: true')
    expect(template).toContain('stroke: (x, y) =>')
  })
})
