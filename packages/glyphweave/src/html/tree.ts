import type { Root, Element } from 'hast'
import { visit } from 'unist-util-visit'
import type { HastNode } from './types.js'

export function extractBody(root: Root): Root | Element {
  let found: Element | undefined
  visit(root, 'element', (node) => {
    if (!found && node.tagName === 'body') found = node
  })
  return found ?? root
}

export function propertyValue(node: HastNode, name: string) {
  if (node.type !== 'element') return undefined
  const camelName = name.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase())
  const value = node.properties?.[name] ?? node.properties?.[camelName]
  return typeof value === 'string' ? value : undefined
}

export function classList(node: HastNode) {
  if (node.type !== 'element') return []
  const className = node.properties?.className
  if (Array.isArray(className)) return className.map(String)
  return []
}

export function textContent(node: HastNode): string {
  if (node.type === 'text') return node.value ?? ''
  return ('children' in node ? node.children : []).map(textContent).join('')
}

export function isHeading(node: HastNode): node is Element {
  return node.type === 'element' && /^h[1-6]$/.test(node.tagName ?? '')
}
