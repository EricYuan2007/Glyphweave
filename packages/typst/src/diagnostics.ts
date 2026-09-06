import type { GlyphweaveDiagnostic } from '@glyphweave/schema'

export function parseTypstDiagnostics(output: string): GlyphweaveDiagnostic[] {
  const diagnostics: GlyphweaveDiagnostic[] = []
  for (const rawLine of output.split(/\r?\n/)) {
    const line = rawLine.trim()
    const warning = line.match(/^warning:\s*(.+)$/i)
    const message = warning?.[1]?.trim()
    if (!message) continue
    if (/^unknown font family:/i.test(message)) {
      if (
        !diagnostics.some((item) => item.code === 'typst-font-missing' && item.message === message)
      ) {
        diagnostics.push({ code: 'typst-font-missing', severity: 'warning', message })
      }
      continue
    }

    if (message === 'equation was ignored during HTML export') {
      diagnostics.push({
        code: 'typst-html-equation-ignored',
        severity: 'error',
        message,
      })
      continue
    }

    if (/^.+ was ignored during HTML export$/.test(message)) {
      diagnostics.push({
        code: 'typst-html-content-ignored',
        severity: 'error',
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
