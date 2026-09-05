import type { Root } from 'hast'
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
  const used = new Set<string>()
  const redirects = new Map<string, string>()
  visit(root as Root, 'element', (node: HastNode) => {
    if (!node.properties) node.properties = {}
    const old = typeof node.properties.id === 'string' ? node.properties.id : undefined
    if (!old && !isHeading(node)) return
    const base =
      isHeading(node) && (mode === 'stable' || !old) ? slugifyHeading(textContent(node)) : old!
    let next = base
    let suffix = 2
    while (used.has(next)) next = `${base}-${suffix++}`
    used.add(next)
    node.properties.id = next
    if (old && !redirects.has(old)) redirects.set(old, next)
  })
  visit(root as Root, 'element', (node: HastNode) => {
    if (!node.properties) return
    for (const key of ['href', 'xLinkHref']) {
      const value = node.properties[key]
      if (typeof value === 'string' && value.startsWith('#') && redirects.has(value.slice(1)))
        node.properties[key] = `#${redirects.get(value.slice(1))}`
    }
    for (const key of ['ariaLabelledBy', 'ariaDescribedBy', 'headers']) {
      const value = node.properties[key]
      if (typeof value === 'string')
        node.properties[key] = value
          .split(/\s+/)
          .map((id) => redirects.get(id) ?? id)
          .join(' ')
    }
  })
}

export function extractToc(root: HastNode): TocItem[] {
  const toc: TocItem[] = []
  visit(root as Root, 'element', (node: HastNode) => {
    if (!isHeading(node)) return
    const depth = Number(node.tagName?.slice(1))
    if (depth < 1 || depth > 4) return
    toc.push({ depth, title: textContent(node), id: String(node.properties?.id ?? '') })
  })
  return toc
}
