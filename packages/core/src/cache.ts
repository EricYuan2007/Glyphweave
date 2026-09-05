import { cp, lstat, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { ContentIndexSchema, ManifestSchema, type GlyphweaveManifest } from '@glyphweave/schema'
import { hash, snapshotTree } from './fingerprint.js'

export interface CacheEntry {
  key: string
  directory: string
  files: Record<string, string>
}
export interface BuildCache {
  version: 1
  entries: Record<string, CacheEntry>
}

async function confined(root: string, candidate: string) {
  const resolved = path.resolve(root, candidate)
  const relative = path.relative(await realpath(root), await realpath(resolved))
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative))
    throw new Error('Cache path escapes generation')
  if ((await lstat(resolved)).isSymbolicLink()) throw new Error('Cache links are not reusable')
  return resolved
}

/** Only the cache belonging to the committed index is eligible for reuse. */
export async function readCache(rootDir: string, output: string): Promise<BuildCache> {
  try {
    const index = ContentIndexSchema.parse(
      JSON.parse(await readFile(path.join(output, 'content-index.json'), 'utf8')),
    )
    if (!index.cachePath) throw new Error('No cache')
    const cachePath = await confined(
      path.join(output, 'generations'),
      path.resolve(rootDir, index.cachePath),
    )
    const cache = JSON.parse(await readFile(cachePath, 'utf8')) as BuildCache
    if (cache.version !== 1 || !cache.entries || typeof cache.entries !== 'object')
      throw new Error('Unknown cache')
    return cache
  } catch {
    return { version: 1, entries: {} }
  }
}

/** Hash every artifact before and after copying; cache corruption is a miss, never a publish. */
export async function reusePost(
  rootDir: string,
  output: string,
  destination: string,
  entry: CacheEntry | undefined,
  key: string,
): Promise<GlyphweaveManifest | undefined> {
  if (!entry || entry.key !== key) return undefined
  try {
    const source = await confined(
      path.join(output, 'generations'),
      path.resolve(rootDir, entry.directory),
    )
    const files = await snapshotTree(source)
    if (
      Object.keys(files).some((name) => name.endsWith('/@link')) ||
      hash(JSON.stringify(files)) !== hash(JSON.stringify(entry.files))
    )
      return undefined
    const manifest = ManifestSchema.parse(
      JSON.parse(await readFile(path.join(source, 'manifest.json'), 'utf8')),
    )
    const rebase = (file: string) => {
      const relative = path.relative(source, path.resolve(rootDir, file))
      if (
        relative.startsWith('..') ||
        path.isAbsolute(relative) ||
        !files[relative.replace(/\\/g, '/')]
      )
        throw new Error('Invalid cached manifest path')
      return path.relative(rootDir, path.join(destination, relative)).replace(/\\/g, '/')
    }
    manifest.html = {
      rawPath: rebase(manifest.html.rawPath),
      contentPath: rebase(manifest.html.contentPath),
      tocPath: rebase(manifest.html.tocPath),
    }
    if (manifest.pdf.path) manifest.pdf.path = rebase(manifest.pdf.path)
    manifest.assets = manifest.assets.map((asset) => ({ ...asset, output: rebase(asset.output) }))
    manifest.createdAt = new Date().toISOString()
    await cp(source, destination, { recursive: true, errorOnExist: true, force: false })
    if (hash(JSON.stringify(await snapshotTree(destination))) !== hash(JSON.stringify(files)))
      throw new Error('Cache changed during copy')
    await writeFile(path.join(destination, 'manifest.json'), JSON.stringify(manifest, null, 2))
    return manifest
  } catch {
    await rm(destination, { recursive: true, force: true })
    return undefined
  }
}
