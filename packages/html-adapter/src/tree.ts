import { visit } from 'unist-util-visit'
import type { HastNode } from './types.js'

export function extractBody(root: HastNode): HastNode {
  let found: HastNode | undefined
  visit(root as any, 'element', (node: HastNode) => {
    if (!found && node.tagName === 'body') found = node
  })
  return found ?? root
}

export function propertyValue(node: HastNode, name: string) {
  const camelName = name.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase())
  const value = node.properties?.[name] ?? node.properties?.[camelName]
  return typeof value === 'string' ? value : undefined
}

export function classList(node: HastNode) {
  const className = node.properties?.className
  if (Array.isArray(className)) return className.map(String)
  if (typeof className === 'string') return className.split(/\s+/)
  return []
}

export function textContent(node: HastNode): string {
  if (node.type === 'text') return node.value ?? ''
  return (node.children ?? []).map(textContent).join('').trim()
}

export function isHeading(node: HastNode) {
  return node.type === 'element' && /^h[1-6]$/.test(node.tagName ?? '')
}
