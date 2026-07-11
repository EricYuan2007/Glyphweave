import type { GlyphweaveDiagnostic } from '@glyphweave/schema'

export function parseTypstDiagnostics(output: string): GlyphweaveDiagnostic[] {
  const diagnostics: GlyphweaveDiagnostic[] = []
  for (const rawLine of output.split(/\r?\n/)) {
    const line = rawLine.trim()
    const warning = line.match(/^warning:\s*(.+)$/i)
    const message = warning?.[1]?.trim()
    if (!message) continue

    if (message === 'equation was ignored during HTML export') {
      diagnostics.push({
        code: 'typst-html-equation-ignored',
        severity: 'warning',
        message,
      })
      continue
    }

    if (/^.+ was ignored during HTML export$/.test(message)) {
      diagnostics.push({
        code: 'typst-html-content-ignored',
        severity: 'warning',
        message,
      })
      continue
    }

    if (
      /HTML export is experimental/i.test(message) ||
      /html export is under active development/i.test(message)
    ) {
      diagnostics.push({
        code: 'typst-html-experimental',
        severity: 'info',
        message,
      })
    }
  }
  return diagnostics
}
