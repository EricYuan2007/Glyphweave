import { isWithin } from '../paths.js'
import { z } from 'zod'
import { cp, lstat, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { ContentIndexSchema, ManifestSchema, type GlyphweaveManifest } from '../schema/index.js'
import { hash, snapshotTree, InvalidTree } from './fingerprint.js'

const CacheSchema = z.strictObject({
  version: z.literal(1),
  entries: z.record(
    z.string(),
    z.strictObject({
      key: z.string(),
      directory: z.string(),
      files: z.record(z.string(), z.string()),
    }),
  ),
})
export type BuildCache = z.infer<typeof CacheSchema>
export type CacheEntry = BuildCache['entries'][string]
class InvalidCache extends Error {}
function isCacheMiss(error: unknown) {
  return (
    error instanceof InvalidCache ||
    error instanceof InvalidTree ||
    error instanceof SyntaxError ||
    error instanceof z.ZodError ||
    ['ENOENT', 'ENOTDIR', 'EISDIR', 'ELOOP'].includes((error as NodeJS.ErrnoException)?.code ?? '')
  )
}

async function confined(root: string, candidate: string) {
  const resolved = path.resolve(root, candidate)
  if (!isWithin(await realpath(root), await realpath(resolved)))
    throw new InvalidCache('Cache path escapes generation')
  if ((await lstat(resolved)).isSymbolicLink())
    throw new InvalidCache('Cache links are not reusable')
  return resolved
}

/** Only the cache belonging to the committed index is eligible for reuse. */
export async function readCache(rootDir: string, output: string): Promise<BuildCache> {
  try {
    const index = ContentIndexSchema.parse(
      JSON.parse(await readFile(path.join(output, 'content-index.json'), 'utf8')),
    )
    const cachePath = await confined(
      path.join(output, 'generations'),
      path.resolve(rootDir, index.cachePath),
    )
    return CacheSchema.parse(JSON.parse(await readFile(cachePath, 'utf8')))
  } catch (error) {
    if (!isCacheMiss(error)) throw error
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
      if (!isWithin(source, path.resolve(rootDir, file)) || !files[relative.replace(/\\/g, '/')])
        throw new InvalidCache('Invalid cached manifest path')
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
      throw new InvalidCache('Cache changed during copy')
    await writeFile(path.join(destination, 'manifest.json'), JSON.stringify(manifest, null, 2))
    return manifest
  } catch (error) {
    await rm(destination, { recursive: true, force: true })
    if (!isCacheMiss(error)) throw error
    return undefined
  }
}
