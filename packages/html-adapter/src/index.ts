import { copyFile, mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { toHtml } from 'hast-util-to-html'
import rehypeParse from 'rehype-parse'
import { unified } from 'unified'
import { visit } from 'unist-util-visit'
import type { DiscoveredTypstPost } from '@glyphweave/core'
import type {
  GlyphweaveCaptureReport,
  GlyphweaveConfig,
  GlyphweaveDiagnostic,
  RewrittenAsset,
  TocItem,
} from '@glyphweave/schema'
import { scanSourceFormulasFromText, type SourceFormula } from '@glyphweave/typst'

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
  math?: Pick<GlyphweaveConfig['math'], 'includeSourceFallback' | 'inlineVerticalShift'>
  diagnostics?: GlyphweaveDiagnostic[]
}

export interface HtmlAdapterOutput {
  contentHtml: string
  toc: TocItem[]
  rewrittenAssets: RewrittenAsset[]
  warnings: string[]
  capture: GlyphweaveCaptureReport
  diagnostics: GlyphweaveDiagnostic[]
}

type HastNode = {
  type: string
  tagName?: string
  value?: string
  properties?: Record<string, unknown>
  children?: HastNode[]
}

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
const resourceAttributes = new Map([
  ['img', ['src', 'srcSet']],
  ['source', ['src', 'srcSet']],
  ['video', ['src', 'poster']],
  ['audio', ['src']],
])

export async function adaptTypstHtml(input: HtmlAdapterInput): Promise<HtmlAdapterOutput> {
  const raw = await readFile(input.rawHtmlPath, 'utf-8')
  assertNoLocalAbsolutePaths(raw)

  const root = unified().use(rehypeParse, { fragment: false }).parse(raw) as HastNode
  const body = extractBody(root)
  const source = await readFile(input.post.sourcePath, 'utf-8')
  const sourceFormulas = scanSourceFormulasFromText(source, input.post.sourcePath)
  const mathmlRecovered = await restoreIgnoredInlineEquations(body, source)
  const mathFrameCapture = normalizeTypstFrameMath(body, sourceFormulas, input.math)
  normalizeHeadingIds(body, input.options.headingIds)
  const toc = extractToc(body)
  const rewrittenAssets = await rewriteAssets(body, input)
  rewriteLinks(body)
  if (input.options.sanitize) {
    sanitize(body)
  }
  const diagnostics = [
    ...(input.diagnostics ?? []),
    ...createCaptureDiagnostics(sourceFormulas, mathFrameCapture.outputMathFrameCount),
  ]
  const capture = createCaptureReport(body, {
    sourceFormulaCount: sourceFormulas.length,
    mathmlRecovered,
    typstFrameSvg: mathFrameCapture.outputMathFrameCount,
    sourceFallbacks: mathFrameCapture.sourceFallbacks,
    diagnostics,
  })

  const contentHtml = toHtml({ type: 'root', children: body.children ?? [] } as any)
  assertNoLocalAbsolutePaths(contentHtml)
  assertNoUnsafeProtocols(contentHtml)

  return {
    contentHtml,
    toc,
    rewrittenAssets,
    warnings: diagnostics
      .filter((diagnostic) => diagnostic.severity !== 'info')
      .map((diagnostic) => diagnostic.message),
    capture,
    diagnostics,
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

async function restoreIgnoredInlineEquations(root: HastNode, source: string) {
  if (!root.children?.length) return 0
  const mathLines = source
    .split(/\r?\n/)
    .map(splitInlineMath)
    .filter((segments) => segments.some((segment) => segment.kind === 'math'))

  let cursor = 0
  let restored = 0
  for (const segments of mathLines) {
    const textSegments = segments
      .filter((segment) => segment.kind === 'text')
      .map((segment) => normalizeText(segment.value))
      .filter(Boolean)
    if (textSegments.length === 0) continue

    const match = findSplitParagraphMatch(root.children, cursor, textSegments)
    if (!match) continue

    root.children.splice(match.start, match.end - match.start + 1, {
      type: 'element',
      tagName: 'p',
      properties: {},
      children: segments.flatMap((segment) =>
        segment.kind === 'math' ? [mathToNode(segment.value)] : textToNodes(segment.value),
      ),
    })
    cursor = match.start + 1
    restored += segments.filter((segment) => segment.kind === 'math').length
  }
  return restored
}

type InlineSegment = { kind: 'text' | 'math'; value: string }

function splitInlineMath(line: string): InlineSegment[] {
  const segments: InlineSegment[] = []
  let cursor = 0
  const inlineMath = /(?<!\\)\$([^$\n]+?)(?<!\\)\$/g
  for (const match of line.matchAll(inlineMath)) {
    const start = match.index ?? 0
    if (start > cursor) {
      segments.push({ kind: 'text', value: line.slice(cursor, start) })
    }
    segments.push({ kind: 'math', value: match[1]!.trim() })
    cursor = start + match[0].length
  }
  if (cursor < line.length) {
    segments.push({ kind: 'text', value: line.slice(cursor) })
  }
  return segments.length > 0 ? segments : [{ kind: 'text', value: line }]
}

function findSplitParagraphMatch(
  children: HastNode[],
  startAt: number,
  textSegments: string[],
): { start: number; end: number } | null {
  for (let index = startAt; index < children.length; index += 1) {
    if (!isParagraph(children[index])) continue
    let childIndex = index
    let segmentIndex = 0
    let end = index

    while (childIndex < children.length && segmentIndex < textSegments.length) {
      const child = children[childIndex]!
      if (isIgnorableText(child)) {
        childIndex += 1
        continue
      }
      if (!isParagraph(child)) break
      if (normalizeText(textContent(child)) !== textSegments[segmentIndex]) break
      end = childIndex
      childIndex += 1
      segmentIndex += 1
    }

    if (segmentIndex === textSegments.length) {
      return { start: index, end }
    }
  }
  return null
}

function mathToNode(expression: string): HastNode {
  const children = expressionToMathChildren(expression)
  return {
    type: 'element',
    tagName: 'math',
    properties: {
      className: ['gw-math'],
      ariaLabel: expression,
    },
    children: children.length === 1 ? children : [element('mrow', children)],
  }
}

function expressionToMathChildren(expression: string): HastNode[] {
  const trimmed = expression.trim()
  const scripted = trimmed.match(/^([A-Za-z]+)([_^])([A-Za-z0-9]+)$/)
  if (scripted) {
    return [
      element(scripted[2] === '_' ? 'msub' : 'msup', [
        mathToken(scripted[1]!),
        mathToken(scripted[3]!),
      ]),
    ]
  }

  const tokens = trimmed.match(/[A-Za-z]+|\d+(?:\.\d+)?|[+\-=×*/()[\]{}]|[^\s]/g) ?? [trimmed]
  return tokens.map(mathToken)
}

function mathToken(token: string): HastNode {
  if (/^\d/.test(token)) return element('mn', [{ type: 'text', value: token }])
  if (/^[A-Za-z]+$/.test(token)) return element('mi', [{ type: 'text', value: token }])
  if (/^[+\-=×*/()[\]{}]$/.test(token)) return element('mo', [{ type: 'text', value: token }])
  return element('mtext', [{ type: 'text', value: token }])
}

function element(tagName: string, children: HastNode[]): HastNode {
  return { type: 'element', tagName, properties: {}, children }
}

function textToNodes(value: string): HastNode[] {
  return value ? [{ type: 'text', value }] : []
}

function normalizeTypstFrameMath(
  root: HastNode,
  formulas: SourceFormula[],
  options: Pick<GlyphweaveConfig['math'], 'includeSourceFallback' | 'inlineVerticalShift'> | undefined,
) {
  let formulaIndex = 0
  let outputMathFrameCount = 0
  let sourceFallbacks = 0

  const visitChildren = (node: HastNode, parent?: HastNode) => {
    const children = node.children
    if (!children) return

    for (let index = 0; index < children.length; index += 1) {
      const child = children[index]!
      if (isTypstFrameSvg(child)) {
        const formula = formulas[formulaIndex++]
        const kind = inferMathFrameKind(child, parent)
        const wrapper = createMathWrapper(child, kind, formula, options)
        children[index] = wrapper
        outputMathFrameCount += 1
        if (formula && options?.includeSourceFallback !== false) sourceFallbacks += 1
        continue
      }

      if (isInlineSvgContainer(child) && child.children?.some(isTypstFrameSvg)) {
        const svg = child.children.find(isTypstFrameSvg)!
        const formula = formulas[formulaIndex++]
        const wrapper = createMathWrapper(svg, 'inline', formula, options)
        children[index] = wrapper
        outputMathFrameCount += 1
        if (formula && options?.includeSourceFallback !== false) sourceFallbacks += 1
        continue
      }

      visitChildren(child, node)
    }
  }

  visitChildren(root)
  return { outputMathFrameCount, sourceFallbacks }
}

function createMathWrapper(
  svg: HastNode,
  kind: 'inline' | 'block',
  formula: SourceFormula | undefined,
  options: Pick<GlyphweaveConfig['math'], 'includeSourceFallback' | 'inlineVerticalShift'> | undefined,
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
      options?.inlineVerticalShift ?? '-0.12em',
    )}`
  }

  return {
    type: 'element',
    tagName,
    properties,
    children,
  }
}

function safeInlineShift(value: string) {
  const trimmed = value.trim()
  return /^[+-]?(?:\d+|\d*\.\d+)(?:em|rem|px|%)$/.test(trimmed) ? trimmed : '-0.12em'
}

function inferMathFrameKind(svg: HastNode, parent: HastNode | undefined): 'inline' | 'block' {
  if (parent?.tagName === 'p') return 'inline'
  const style = typeof svg.properties?.style === 'string' ? svg.properties.style : ''
  return /display:\s*inline/i.test(style) ? 'inline' : 'block'
}

function isInlineSvgContainer(node: HastNode) {
  return node.type === 'element' && node.tagName === 'span' && node.children?.some(isTypstFrameSvg)
}

function isTypstFrameSvg(node: HastNode | undefined) {
  return (
    node?.type === 'element' &&
    node.tagName === 'svg' &&
    classList(node).includes('typst-frame')
  )
}

function classList(node: HastNode) {
  const className = node.properties?.className
  if (Array.isArray(className)) return className.map(String)
  if (typeof className === 'string') return className.split(/\s+/)
  return []
}

function createCaptureDiagnostics(
  formulas: SourceFormula[],
  outputMathFrameCount: number,
): GlyphweaveDiagnostic[] {
  if (formulas.length === outputMathFrameCount) return []
  return [
    {
      code: 'glyphweave-math-count-mismatch',
      severity: 'warning',
      message: `Source formulas (${formulas.length}) did not match rendered math frames (${outputMathFrameCount})`,
    },
  ]
}

function createCaptureReport(
  root: HastNode,
  input: {
    sourceFormulaCount: number
    mathmlRecovered: number
    typstFrameSvg: number
    sourceFallbacks: number
    diagnostics: GlyphweaveDiagnostic[]
  },
): GlyphweaveCaptureReport {
  const content = {
    headings: 0,
    paragraphs: 0,
    lists: 0,
    tables: 0,
    images: 0,
    codeBlocks: 0,
    footnotes: 0,
    frames: 0,
  }
  const math = {
    sourceFormulaCount: input.sourceFormulaCount,
    outputMathFrameCount: input.typstFrameSvg,
    total: 0,
    inline: 0,
    block: 0,
    nativeMathml: 0,
    mathmlRecovered: input.mathmlRecovered,
    typstFrameSvg: input.typstFrameSvg,
    sourceFallbacks: input.sourceFallbacks,
    failed: 0,
    mismatch: input.sourceFormulaCount !== input.typstFrameSvg && input.typstFrameSvg > 0,
  }

  visit(root as any, 'element', (node: HastNode) => {
    if (isHeading(node)) content.headings += 1
    if (node.tagName === 'p') content.paragraphs += 1
    if (node.tagName === 'ul' || node.tagName === 'ol') content.lists += 1
    if (node.tagName === 'table') content.tables += 1
    if (node.tagName === 'img') content.images += 1
    if (node.tagName === 'pre' || node.tagName === 'code') content.codeBlocks += 1
    if (isTypstFrameSvg(node)) content.frames += 1
    const classes = classList(node)
    if (node.tagName === 'math') {
      math.nativeMathml += 1
      math.total += 1
    } else if (classes.includes('gw-math')) {
      math.total += 1
      if (classes.includes('gw-math--inline')) math.inline += 1
      if (classes.includes('gw-math--block')) math.block += 1
    }
  })

  math.failed = Math.max(0, input.sourceFormulaCount - math.total)
  const hasErrors = input.diagnostics.some((diagnostic) => diagnostic.severity === 'error')
  const hasWarnings =
    input.diagnostics.some((diagnostic) => diagnostic.severity === 'warning') || math.mismatch

  return {
    status: hasErrors ? 'failed' : hasWarnings ? 'warning' : 'ok',
    content,
    math,
  }
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, ' ').trim()
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
      if (attr === 'srcSet') {
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
    if (lower === 'style' && node.tagName !== 'svg') {
      if (typeof value === 'string' && isSafeMathStyle(node, value)) {
        continue
      }
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

function textContent(node: HastNode): string {
  if (node.type === 'text') return node.value ?? ''
  return (node.children ?? []).map(textContent).join('').trim()
}

function isParagraph(node: HastNode | undefined) {
  return node?.type === 'element' && node.tagName === 'p'
}

function isIgnorableText(node: HastNode | undefined) {
  return node?.type === 'text' && normalizeText(node.value ?? '') === ''
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
