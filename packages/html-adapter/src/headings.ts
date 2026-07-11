import { visit } from 'unist-util-visit'
import type { TocItem } from '@glyphweave/schema'
import { isHeading, textContent } from './tree.js'
import type { HastNode, HtmlAdapterOptions } from './types.js'

export function slugifyHeading(text: string): string {
  const slug = text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\p{Letter}\p{Number}\p{Mark}-]+/gu, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return slug || 'section'
}

export function normalizeHeadingIds(root: HastNode, mode: HtmlAdapterOptions['headingIds']) {
  const seen = new Map<string, number>()
  visit(root as any, 'element', (node: HastNode) => {
    if (!isHeading(node)) return
    node.properties ??= {}
    const existing = typeof node.properties.id === 'string' ? node.properties.id : undefined
    const base = mode === 'preserve' && existing ? existing : slugifyHeading(textContent(node))
    const count = seen.get(base) ?? 0
    seen.set(base, count + 1)
    node.properties.id = count === 0 ? base : `${base}-${count + 1}`
  })
}

export function extractToc(root: HastNode): TocItem[] {
  const toc: TocItem[] = []
  visit(root as any, 'element', (node: HastNode) => {
    if (!isHeading(node)) return
    const depth = Number(node.tagName?.slice(1))
    if (depth < 1 || depth > 4) return
    toc.push({ depth, title: textContent(node), id: String(node.properties?.id ?? '') })
  })
  return toc
}
