import { visit } from 'unist-util-visit'
import { classList } from './tree.js'
import type { HastNode } from './types.js'

const deniedTags = new Set([
  'script',
  'iframe',
  'object',
  'embed',
  'form',
  'input',
  'button',
  'style',
  'foreignObject',
])
const urlAttributes = new Set(['href', 'src', 'poster', 'xlinkhref', 'xlink:href'])

export function rewriteLinks(root: HastNode) {
  visit(root as any, 'element', (node: HastNode) => {
    if (node.tagName !== 'a' || !node.properties) return
    const href = node.properties.href
    if (typeof href !== 'string') return
    assertNoLocalAbsolutePaths(href)
    if (isUnsafeProtocol(href)) {
      delete node.properties.href
      return
    }
    if (isExternalUrl(href)) node.properties.rel = 'noopener noreferrer'
  })
}

export function sanitize(root: HastNode) {
  const cleanChildren = (node: HastNode): HastNode | null => {
    if (node.type === 'element') {
      if (node.tagName && deniedTags.has(node.tagName)) return null
      sanitizeProperties(node)
    }
    if (node.children) {
      node.children = node.children
        .map(cleanChildren)
        .filter((child): child is HastNode => child !== null)
    }
    return node
  }
  cleanChildren(root)
}

function sanitizeProperties(node: HastNode) {
  if (!node.properties) return
  for (const key of Object.keys(node.properties)) {
    const lower = key.toLowerCase()
    const value = node.properties[key]
    if (lower === 'style' && node.tagName !== 'svg') {
      if (typeof value === 'string' && isSafeMathStyle(node, value)) continue
      delete node.properties[key]
      continue
    }
    if (lower.startsWith('on')) {
      delete node.properties[key]
      continue
    }
    if (urlAttributes.has(lower) && typeof value === 'string' && isUnsafeProtocol(value)) {
      delete node.properties[key]
    }
  }
}

function isSafeMathStyle(node: HastNode, value: string) {
  if (!classList(node).includes('gw-math--inline')) return false
  return /^--gw-math-inline-shift:\s*[+-]?(?:\d+|\d*\.\d+)(?:em|rem|px|%)$/.test(value.trim())
}

export function isExternalUrl(value: string) {
  return /^(?:https?:)?\/\//i.test(value)
}

export function isUnsafeProtocol(value: string) {
  return /^\s*javascript:/i.test(value) || /^\s*file:/i.test(value)
}

export function assertNoUnsafeProtocols(value: string) {
  if (isUnsafeProtocol(value)) throw new Error(`Unsafe URL protocol detected: ${value}`)
}

export function assertNoLocalAbsolutePaths(value: string) {
  if (/(?:\/Users\/|\/home\/|~\/|file:\/\/|[A-Za-z]:\\)/.test(value)) {
    throw new Error(`Local absolute path detected: ${value}`)
  }
}
