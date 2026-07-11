import { copyFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { visit } from 'unist-util-visit'
import type { RewrittenAsset } from '@glyphweave/schema'
import { assertNoLocalAbsolutePaths, isExternalUrl } from './security.js'
import type { HastNode, HtmlAdapterInput } from './types.js'

const resourceAttributes = new Map([
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
  const pending: Promise<void>[] = []
  visit(root as any, 'element', (node: HastNode) => {
    if (!node.tagName || !node.properties) return
    for (const attr of resourceAttributes.get(node.tagName) ?? []) {
      const value = node.properties[attr]
      if (typeof value !== 'string') continue
      if (attr === 'srcSet') pending.push(rewriteSrcset(node, attr, value, input, rewritten))
      else pending.push(rewriteUrlAttribute(node, attr, value, input, rewritten))
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
  rewritten.set(source, { source, output, publicPath })
  return publicPath
}
