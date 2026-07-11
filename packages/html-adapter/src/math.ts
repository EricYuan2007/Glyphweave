import type { GlyphweaveConfig } from '@glyphweave/schema'
import type { SourceFormula } from '@glyphweave/typst'
import { propertyValue } from './tree.js'
import type { HastNode } from './types.js'

export function normalizeNativeMathml(root: HastNode) {
  let nativeMathml = 0
  const visitChildren = (node: HastNode) => {
    if (!node.children) return
    for (let index = 0; index < node.children.length; index += 1) {
      const child = node.children[index]!
      if (child.type === 'element' && child.tagName === 'math') {
        const kind = propertyValue(child, 'display') === 'block' ? 'block' : 'inline'
        node.children[index] = {
          type: 'element',
          tagName: kind === 'inline' ? 'span' : 'div',
          properties: {
            className: ['gw-math', `gw-math--${kind}`],
            'data-gw-renderer': 'native-mathml',
          },
          children: [child],
        }
        nativeMathml += 1
        continue
      }
      visitChildren(child)
    }
  }
  visitChildren(root)
  return nativeMathml
}

export function normalizeTypstFrameMath(
  root: HastNode,
  formulas: SourceFormula[],
  options: GlyphweaveConfig['math'] | undefined,
) {
  let formulaIndex = 0
  let typstFrameSvg = 0
  let sourceFallbacks = 0
  const visitChildren = (node: HastNode) => {
    const children = node.children
    if (!children) return
    for (let index = 0; index < children.length; index += 1) {
      const child = children[index]!
      const kind = glyphweaveMathKind(child)
      const svg = kind ? child.children?.find(isSvg) : undefined
      if (kind && svg) {
        const formula = formulas[formulaIndex++]
        children[index] = createMathWrapper(svg, kind, formula, options?.svg)
        typstFrameSvg += 1
        if (formula && options?.svg.includeSourceFallback !== false) sourceFallbacks += 1
        continue
      }
      visitChildren(child)
    }
  }
  visitChildren(root)
  return { typstFrameSvg, sourceFallbacks }
}

function createMathWrapper(
  svg: HastNode,
  kind: 'inline' | 'block',
  formula: SourceFormula | undefined,
  options: GlyphweaveConfig['math']['svg'] | undefined,
): HastNode {
  const tagName = kind === 'inline' ? 'span' : 'div'
  const source = formula?.source
  const children = [svg]
  if (source && options?.includeSourceFallback !== false) {
    children.push({
      type: 'element',
      tagName: 'span',
      properties: { className: ['gw-sr-only'] },
      children: [{ type: 'text', value: `Formula: ${source}` }],
    })
  }

  const properties: Record<string, unknown> = {
    className: ['gw-math', `gw-math--${kind}`],
    'data-gw-renderer': 'typst-frame-svg',
    ...(source ? { ariaLabel: `Formula: ${source}`, 'data-gw-source': source } : {}),
  }
  if (kind === 'inline') {
    properties.style = `--gw-math-inline-shift: ${safeInlineShift(
      options?.inlineVerticalShift ?? '0.08em',
    )}`
  }
  return { type: 'element', tagName, properties, children }
}

function safeInlineShift(value: string) {
  const trimmed = value.trim()
  return /^[+-]?(?:\d+|\d*\.\d+)(?:em|rem|px|%)$/.test(trimmed) ? trimmed : '0.08em'
}

function glyphweaveMathKind(node: HastNode): 'inline' | 'block' | null {
  const value = propertyValue(node, 'data-gw-math')
  return value === 'inline' || value === 'block' ? value : null
}

function isSvg(node: HastNode | undefined) {
  return node?.type === 'element' && node.tagName === 'svg'
}
