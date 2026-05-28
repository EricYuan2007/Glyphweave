import { describe, expect, it } from 'vitest'
import { parseTypstDiagnostics, scanSourceFormulasFromText } from '@glyphweave/typst'

describe('Typst math helpers', () => {
  it('scans inline and block source formulas while skipping raw code blocks', () => {
    const formulas = scanSourceFormulasFromText(
      [
        '= Math Demo',
        '',
        'Inline $q$ and $a + b = c$ with escaped \\$not math\\$ and raw `$ignored$`.',
        '',
        '$ sum_(i=1)^n x_i^2 $',
        '',
        '```typst',
        '$ignored$',
        '```',
        '',
        '$',
        'cases(',
        '  x if x > 0,',
        '  -x otherwise,',
        ')',
        '$',
      ].join('\n'),
      'index.typ',
    )

    expect(formulas.map(({ id, kind, source, startLine, endLine }) => ({
      id,
      kind,
      source,
      startLine,
      endLine,
    }))).toEqual([
      { id: 'math-1', kind: 'inline', source: 'q', startLine: 3, endLine: 3 },
      { id: 'math-2', kind: 'inline', source: 'a + b = c', startLine: 3, endLine: 3 },
      { id: 'math-3', kind: 'block', source: 'sum_(i=1)^n x_i^2', startLine: 5, endLine: 5 },
      {
        id: 'math-4',
        kind: 'block',
        source: 'cases(\n  x if x > 0,\n  -x otherwise,\n)',
        startLine: 11,
        endLine: 16,
      },
    ])
  })

  it('parses Typst HTML export diagnostics into stable codes', () => {
    const diagnostics = parseTypstDiagnostics(
      [
        'warning: equation was ignored during HTML export',
        'warning: image was ignored during HTML export',
        'warning: html export is under active development and incomplete',
      ].join('\n'),
    )

    expect(diagnostics.map(({ code, severity, message }) => ({ code, severity, message }))).toEqual([
      {
        code: 'typst-html-equation-ignored',
        severity: 'warning',
        message: 'equation was ignored during HTML export',
      },
      {
        code: 'typst-html-content-ignored',
        severity: 'warning',
        message: 'image was ignored during HTML export',
      },
      {
        code: 'typst-html-experimental',
        severity: 'info',
        message: 'html export is under active development and incomplete',
      },
    ])
  })
})
