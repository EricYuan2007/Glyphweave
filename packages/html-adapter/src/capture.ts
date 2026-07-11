import { visit } from 'unist-util-visit'
import type { GlyphweaveCaptureReport, GlyphweaveDiagnostic } from '@glyphweave/schema'
import type { SourceFormula } from '@glyphweave/typst'
import { classList, isHeading, propertyValue } from './tree.js'
import type { HastNode } from './types.js'

export function createCaptureDiagnostics(
  formulas: SourceFormula[],
  renderedCount: number,
): GlyphweaveDiagnostic[] {
  if (formulas.length === renderedCount) return []
  return [{
    code: 'glyphweave-math-count-mismatch',
    severity: 'warning',
    message: `Source formulas (${formulas.length}) did not match rendered math elements (${renderedCount})`,
  }]
}

export function createCaptureReport(
  root: HastNode,
  input: {
    sourceFormulaCount: number
    nativeMathml: number
    typstFrameSvg: number
    sourceFallbacks: number
    diagnostics: GlyphweaveDiagnostic[]
  },
): GlyphweaveCaptureReport {
  const content = {
    headings: 0, paragraphs: 0, lists: 0, tables: 0, images: 0,
    codeBlocks: 0, footnotes: 0, frames: 0,
  }
  const math = {
    sourceFormulaCount: input.sourceFormulaCount,
    renderedCount: input.nativeMathml + input.typstFrameSvg,
    total: input.nativeMathml + input.typstFrameSvg,
    inline: 0, block: 0,
    nativeMathml: input.nativeMathml,
    typstFrameSvg: input.typstFrameSvg,
    sourceFallbacks: input.sourceFallbacks,
    failed: 0,
    mismatch: input.sourceFormulaCount !== input.nativeMathml + input.typstFrameSvg,
  }
  visit(root as any, 'element', (node: HastNode) => {
    if (isHeading(node)) content.headings += 1
    if (node.tagName === 'p') content.paragraphs += 1
    if (node.tagName === 'ul' || node.tagName === 'ol') content.lists += 1
    if (node.tagName === 'table') content.tables += 1
    if (node.tagName === 'img') content.images += 1
    if (node.tagName === 'pre' || node.tagName === 'code') content.codeBlocks += 1
    if (node.tagName === 'section' && node.properties?.role === 'doc-endnotes') {
      content.footnotes += countListItems(node)
    }
    const classes = classList(node)
    if (classes.includes('gw-math')) {
      if (classes.includes('gw-math--inline')) math.inline += 1
      if (classes.includes('gw-math--block')) math.block += 1
      if (propertyValue(node, 'data-gw-renderer') === 'typst-frame-svg') content.frames += 1
    }
  })
  math.failed = Math.max(0, input.sourceFormulaCount - math.total)
  const hasErrors = input.diagnostics.some((diagnostic) => diagnostic.severity === 'error')
  const hasWarnings =
    input.diagnostics.some((diagnostic) => diagnostic.severity === 'warning') || math.mismatch
  return { status: hasErrors ? 'failed' : hasWarnings ? 'warning' : 'ok', content, math }
}

function countListItems(node: HastNode): number {
  let count = 0
  visit(node as any, 'element', (child: HastNode) => {
    if (child !== node && child.tagName === 'li') count += 1
  })
  return count
}
