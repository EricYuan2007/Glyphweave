import type { Root } from 'hast'
import { createHash } from 'node:crypto'
import { copyFile, mkdir, readFile, readdir, realpath } from 'node:fs/promises'
import path from 'node:path'
import { visit } from 'unist-util-visit'
import type { RewrittenAsset } from '../schema/index.js'
import { assertNoLocalAbsolutePaths, isExternalUrl, isUnsafeProtocol } from './security.js'
import type { HastNode, HtmlAdapterInput } from './types.js'

const resourceAttributes = new Map([
  ['a', ['href']],
  ['img', ['src', 'srcSet']],
  ['source', ['src', 'srcSet']],
  ['video', ['src', 'poster']],
  ['audio', ['src']],
])

export async function rewriteAssets(
  root: HastNode,
  input: HtmlAdapterInput,
): Promise<RewrittenAsset[]> {
  await restoreEmbeddedImages(root, input)
  const rewritten = new Map<string, RewrittenAsset>()
  const pending: Array<() => Promise<void>> = []
  visit(root as Root, 'element', (node: HastNode) => {
    if (!node.tagName || !node.properties) return
    for (const attr of resourceAttributes.get(node.tagName) ?? []) {
      const value = node.properties[attr]
      if (typeof value !== 'string') continue
      if (node.tagName === 'a' && !value.startsWith('assets/')) continue
      if (attr === 'srcSet') pending.push(() => rewriteSrcset(node, attr, value, input, rewritten))
      else pending.push(() => rewriteUrlAttribute(node, attr, value, input, rewritten))
    }
  })
  for (const run of pending) await run()
  return [...rewritten.values()]
}

/** Typst 0.15 embeds images. Recover only byte-identical, author-owned assets;
 * never enable arbitrary data: URLs in the sanitizer or publish decoded payloads.
 */
async function restoreEmbeddedImages(root: HastNode, input: HtmlAdapterInput) {
  const images: HastNode[] = []
  visit(root as Root, 'element', (node: HastNode) => {
    if (
      node.tagName === 'img' &&
      typeof node.properties?.src === 'string' &&
      /^data:/i.test(node.properties.src)
    )
      images.push(node)
  })
  if (!images.length) return
  const mimeExtensions: Record<string, string[]> = {
    'image/svg+xml': ['.svg'],
    'image/png': ['.png'],
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/gif': ['.gif'],
    'image/webp': ['.webp'],
  }
  const assetsRoot = input.post.assetDir ?? path.join(input.post.postDir, 'assets')
  const candidates = await readdir(assetsRoot, { recursive: true, withFileTypes: true })
  const assets = new Map<string, string>()
  for (const entry of candidates) {
    if (!entry.isFile()) continue // Symlinks are not ownership evidence.
    const extension = path.extname(entry.name).toLowerCase()
    const mime = Object.keys(mimeExtensions).find((type) =>
      mimeExtensions[type].includes(extension),
    )
    if (!mime) continue
    const source = path.join(entry.parentPath, entry.name)
    const bytes = await readFile(source)
    const hash = createHash('sha256').update(bytes).digest('hex')
    assets.set(`${mime}:${hash}`, source)
  }
  for (const image of images) {
    const value = image.properties!.src as string
    const match = /^data:(image\/[a-z0-9+.-]+);base64,([a-zA-Z0-9+/]*={0,2})$/.exec(value)
    if (!match || !mimeExtensions[match[1]] || value.length > 32 * 1024 * 1024)
      throw new Error('Unsupported embedded image encoding')
    const bytes = Buffer.from(match[2], 'base64')
    if (bytes.toString('base64') !== match[2]) throw new Error('Invalid embedded image base64')
    const source = assets.get(`${match[1]}:${createHash('sha256').update(bytes).digest('hex')}`)
    if (!source) throw new Error('Embedded image has no byte-identical source in post assets')
    // Normal resource rewriting below still applies extension and realpath boundaries.
    image.properties!.src = path.relative(input.post.postDir, source).replace(/\\/g, '/')
  }
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
  if (
    isExternalUrl(value) ||
    value.startsWith('#') ||
    isUnsafeProtocol(value) ||
    value.startsWith('mailto:')
  )
    return value
  if (nodeLink(value)) return value
  assertNoLocalAbsolutePaths(value)
  const [resource, suffix = ''] = value.split(/(?=[?#])/s, 2)
  const source = path.resolve(input.post.postDir, decodeURIComponent(resource))
  const assetsRoot = input.post.assetDir ?? path.join(input.post.postDir, 'assets')
  const relativeToAssets = path.relative(assetsRoot, source)
  if (relativeToAssets.startsWith('..') || path.isAbsolute(relativeToAssets)) {
    throw new Error(`Asset escapes post assets directory: ${value}`)
  }
  const realSource = await realpath(source)
  const realRoot = await realpath(assetsRoot)
  const realRelative = path.relative(realRoot, realSource)
  if (realRelative.startsWith('..') || path.isAbsolute(realRelative))
    throw new Error(`Asset escapes post assets directory: ${value}`)
  const allowed = input.assets?.allowedExtensions ?? [
    '.png',
    '.jpg',
    '.jpeg',
    '.webp',
    '.svg',
    '.gif',
    '.pdf',
  ]
  if (!allowed.includes(path.extname(source).toLowerCase()))
    throw new Error(`Asset extension not allowed: ${value}`)
  const previous = rewritten.get(source)
  if (previous) return previous.publicPath + suffix
  const output = path.join(input.outputDir, 'assets', relativeToAssets)
  const publicPath = `${input.publicBasePath.replace(/\/$/, '')}/posts/${
    input.post.metadata.slug
  }/assets/${relativeToAssets.replace(/\\/g, '/')}`
  await mkdir(path.dirname(output), { recursive: true })
  await copyFile(realSource, output)
  rewritten.set(source, { source, output, publicPath })
  return publicPath + suffix
}

function nodeLink(value: string) {
  return value.startsWith('/') && !/^\/(Users|home|private|tmp|etc|var)\//.test(value)
}
