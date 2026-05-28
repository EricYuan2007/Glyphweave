import { copyFile, mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { toHtml } from 'hast-util-to-html'
import rehypeParse from 'rehype-parse'
import { unified } from 'unified'
import { visit } from 'unist-util-visit'
import type { DiscoveredTypstPost } from '@glyphweave/core'
import type { RewrittenAsset, TocItem } from '@glyphweave/schema'

export interface HtmlAdapterOptions {
  sanitize: boolean
  headingIds: 'preserve' | 'stable'
  scopeClass: string
}

export interface HtmlAdapterInput {
  rawHtmlPath: string
  post: DiscoveredTypstPost
  outputDir: string
  publicBasePath: string
  options: HtmlAdapterOptions
}

export interface HtmlAdapterOutput {
  contentHtml: string
  toc: TocItem[]
  rewrittenAssets: RewrittenAsset[]
  warnings: string[]
}

type HastNode = {
  type: string
  tagName?: string
  value?: string
  properties?: Record<string, unknown>
  children?: HastNode[]
}

const deniedTags = new Set(['script', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'style'])
const urlAttributes = new Set(['href', 'src', 'poster'])
const resourceAttributes = new Map([
  ['img', ['src', 'srcset']],
  ['source', ['src', 'srcset']],
  ['video', ['src', 'poster']],
  ['audio', ['src']],
])

export async function adaptTypstHtml(input: HtmlAdapterInput): Promise<HtmlAdapterOutput> {
  const raw = await readFile(input.rawHtmlPath, 'utf-8')
  assertNoLocalAbsolutePaths(raw)

  const root = unified().use(rehypeParse, { fragment: false }).parse(raw) as HastNode
  const body = extractBody(root)
  normalizeHeadingIds(body, input.options.headingIds)
  const toc = extractToc(body)
  const rewrittenAssets = await rewriteAssets(body, input)
  rewriteLinks(body)
  if (input.options.sanitize) {
    sanitize(body)
  }

  const contentHtml = toHtml({ type: 'root', children: body.children ?? [] } as any)
  assertNoLocalAbsolutePaths(contentHtml)
  assertNoUnsafeProtocols(contentHtml)

  return {
    contentHtml,
    toc,
    rewrittenAssets,
    warnings: [],
  }
}

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

function extractBody(root: HastNode): HastNode {
  let found: HastNode | undefined
  visit(root as any, 'element', (node: HastNode) => {
    if (!found && node.tagName === 'body') {
      found = node
    }
  })

  return found ?? root
}

function normalizeHeadingIds(root: HastNode, mode: HtmlAdapterOptions['headingIds']) {
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

function extractToc(root: HastNode): TocItem[] {
  const toc: TocItem[] = []
  visit(root as any, 'element', (node: HastNode) => {
    if (!isHeading(node)) return
    const depth = Number(node.tagName?.slice(1))
    if (depth < 1 || depth > 4) return
    toc.push({
      depth,
      title: textContent(node),
      id: String(node.properties?.id ?? ''),
    })
  })
  return toc
}

async function rewriteAssets(root: HastNode, input: HtmlAdapterInput): Promise<RewrittenAsset[]> {
  const rewritten = new Map<string, RewrittenAsset>()
  const pending: Promise<void>[] = []

  visit(root as any, 'element', (node: HastNode) => {
    if (!node.tagName || !node.properties) return
    for (const attr of resourceAttributes.get(node.tagName) ?? []) {
      const value = node.properties[attr]
      if (typeof value !== 'string') continue
      if (attr === 'srcset') {
        pending.push(rewriteSrcset(node, attr, value, input, rewritten))
      } else {
        pending.push(rewriteUrlAttribute(node, attr, value, input, rewritten))
      }
    }
  })

  await Promise.all(pending)
  return [...rewritten.values()]
}

async function rewriteSrcset(
  node: HastNode,
  attr: string,
  value: string,
  input: HtmlAdapterInput,
  rewritten: Map<string, RewrittenAsset>,
) {
  const parts = await Promise.all(
    value.split(',').map(async (entry) => {
      const [url, descriptor] = entry.trim().split(/\s+/, 2)
      if (!url) return entry.trim()
      const publicUrl = await rewriteLocalResource(url, input, rewritten)
      return descriptor ? `${publicUrl} ${descriptor}` : publicUrl
    }),
  )
  node.properties![attr] = parts.join(', ')
}

async function rewriteUrlAttribute(
  node: HastNode,
  attr: string,
  value: string,
  input: HtmlAdapterInput,
  rewritten: Map<string, RewrittenAsset>,
) {
  node.properties![attr] = await rewriteLocalResource(value, input, rewritten)
}

async function rewriteLocalResource(
  value: string,
  input: HtmlAdapterInput,
  rewritten: Map<string, RewrittenAsset>,
): Promise<string> {
  if (isExternalUrl(value) || value.startsWith('#') || value.startsWith('data:')) return value
  assertNoLocalAbsolutePaths(value)

  const source = path.resolve(input.post.postDir, value)
  const assetsRoot = input.post.assetDir ?? path.join(input.post.postDir, 'assets')
  const relativeToAssets = path.relative(assetsRoot, source)
  if (relativeToAssets.startsWith('..') || path.isAbsolute(relativeToAssets)) {
    throw new Error(`Asset escapes post assets directory: ${value}`)
  }

  const output = path.join(input.outputDir, 'assets', relativeToAssets)
  const publicPath = `${input.publicBasePath.replace(/\/$/, '')}/posts/${
    input.post.metadata.slug
  }/assets/${relativeToAssets.replace(/\\/g, '/')}`
  await mkdir(path.dirname(output), { recursive: true })
  await copyFile(source, output)
  rewritten.set(source, {
    source,
    output,
    publicPath,
  })
  return publicPath
}

function rewriteLinks(root: HastNode) {
  visit(root as any, 'element', (node: HastNode) => {
    if (node.tagName !== 'a' || !node.properties) return
    const href = node.properties.href
    if (typeof href !== 'string') return
    assertNoLocalAbsolutePaths(href)
    if (isUnsafeProtocol(href)) {
      delete node.properties.href
      return
    }
    if (isExternalUrl(href)) {
      node.properties.rel = 'noopener noreferrer'
    }
  })
}

function sanitize(root: HastNode) {
  const cleanChildren = (node: HastNode): HastNode | null => {
    if (node.type === 'element') {
      if (node.tagName && deniedTags.has(node.tagName)) return null
      sanitizeProperties(node)
    }
    if (node.children) {
      node.children = node.children.map(cleanChildren).filter((child): child is HastNode => child !== null)
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
    if (lower === 'style' || lower.startsWith('on')) {
      delete node.properties[key]
      continue
    }
    if (urlAttributes.has(lower) && typeof value === 'string' && isUnsafeProtocol(value)) {
      delete node.properties[key]
    }
  }
}

function textContent(node: HastNode): string {
  if (node.type === 'text') return node.value ?? ''
  return (node.children ?? []).map(textContent).join('').trim()
}

function isHeading(node: HastNode) {
  return node.type === 'element' && /^h[1-6]$/.test(node.tagName ?? '')
}

function isExternalUrl(value: string) {
  return /^(?:https?:)?\/\//i.test(value)
}

function isUnsafeProtocol(value: string) {
  return /^\s*javascript:/i.test(value) || /^\s*file:/i.test(value)
}

export function assertNoUnsafeProtocols(value: string) {
  if (isUnsafeProtocol(value)) {
    throw new Error(`Unsafe URL protocol detected: ${value}`)
  }
}

export function assertNoLocalAbsolutePaths(value: string) {
  if (/(?:\/Users\/|\/home\/|~\/|file:\/\/|[A-Za-z]:\\)/.test(value)) {
    throw new Error(`Local absolute path detected: ${value}`)
  }
}
