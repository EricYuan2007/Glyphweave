import type { Root } from 'hast'
import { copyFile, mkdir, realpath } from 'node:fs/promises'
import path from 'node:path'
import { visit } from 'unist-util-visit'
import type { RewrittenAsset } from '@glyphweave/schema'
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
