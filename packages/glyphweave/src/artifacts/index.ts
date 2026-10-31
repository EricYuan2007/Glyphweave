import {
  copyFile,
  lstat,
  readdir,
  mkdir,
  readFile,
  realpath,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import {
  ContentIndexSchema,
  ManifestSchema,
  TocItemSchema,
  type GlyphweaveContentIndex,
  type GlyphweaveManifest,
  type TocItem,
} from '../schema/index.js'

import { isWithin } from '../paths.js'

/** Read index metadata only. Use openGlyphweaveSnapshot to consume its artifacts. */
export async function readGlyphweaveContentIndex(
  rootDir: string,
  indexPath = '.glyphweave/content-index.json',
) {
  return ContentIndexSchema.parse(
    JSON.parse(await readFile(path.resolve(rootDir, indexPath), 'utf8')),
  )
}

type Post = GlyphweaveContentIndex['posts'][number]
export interface LoadedPost extends Post {
  contentHtml: string
  toc: TocItem[]
  manifest: GlyphweaveManifest
}
export type GlyphweaveSnapshot = Awaited<ReturnType<typeof openGlyphweaveSnapshot>>

/** Resolve one index and validate every referenced artifact before exposing the snapshot. */
export async function openGlyphweaveSnapshot(
  rootDir: string,
  indexPath = '.glyphweave/content-index.json',
) {
  const root = await realpath(rootDir)
  const indexFile = path.resolve(root, indexPath)
  const output = await realpath(path.dirname(indexFile))
  if (!isWithin(root, output)) throw new Error('Artifact output escapes project')
  const index = await readGlyphweaveContentIndex(root, indexFile)
  const resolveArtifact = async (file: string, boundary: string) => {
    const full = await realpath(path.resolve(root, file))
    if (!isWithin(boundary, full)) throw new Error(`Artifact escapes snapshot boundary: ${file}`)
    return full
  }
  const cacheFile = await resolveArtifact(index.cachePath, path.join(output, 'generations'))
  const generation = path.dirname(cacheFile)
  if (
    path.dirname(generation) !== path.join(output, 'generations') ||
    path.basename(cacheFile) !== 'cache.json'
  )
    throw new Error('Index must reference one generation cache')
  const posts = new Map<string, LoadedPost>()
  const resources = new Map<string, { source: string; name: string }[]>()
  for (const post of index.posts) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(post.slug) || posts.has(post.slug))
      throw new Error(`Invalid or duplicate snapshot slug: ${post.slug}`)
    const manifestFile = await resolveArtifact(post.manifestPath, generation)
    const boundary = path.dirname(manifestFile)
    const manifest = ManifestSchema.parse(JSON.parse(await readFile(manifestFile, 'utf8')))
    if (manifest.slug !== post.slug) throw new Error('Manifest slug mismatch')
    const content = await resolveArtifact(post.contentHtmlPath, boundary)
    const toc = await resolveArtifact(post.tocPath, boundary)
    await resolveArtifact(manifest.html.rawPath, boundary)
    if (
      content !== (await resolveArtifact(manifest.html.contentPath, boundary)) ||
      toc !== (await resolveArtifact(manifest.html.tocPath, boundary)) ||
      manifest.pdf.enabled !== Boolean(manifest.pdf.path) ||
      post.pdfPath !== manifest.pdf.path
    )
      throw new Error('Index and manifest artifact paths disagree')
    const files = []
    for (const asset of manifest.assets) {
      const assets = path.join(boundary, 'assets')
      const source = await resolveArtifact(asset.output, assets)
      const logical = path.resolve(root, asset.output)
      if (!isWithin(assets, logical)) throw new Error('Asset escapes post assets')
      files.push({ source, name: `assets/${path.relative(assets, logical)}` })
    }
    if (manifest.pdf.path)
      files.push({
        source: await resolveArtifact(manifest.pdf.path, boundary),
        name: 'article.pdf',
      })
    posts.set(post.slug, {
      ...post,
      manifest,
      contentHtml: await readFile(content, 'utf8'),
      toc: TocItemSchema.array().parse(JSON.parse(await readFile(toc, 'utf8'))),
    })
    resources.set(post.slug, files)
  }
  return {
    rootDir: root,
    index,
    readPost(slug: string): LoadedPost {
      const post = posts.get(slug)
      if (!post) throw new Error(`Post not found in snapshot: ${slug}`)
      return post
    },
    async copyAssets(slugs: readonly string[], destination: string) {
      for (const slug of slugs) {
        const files = resources.get(slug)
        if (!files) throw new Error(`Post not found in snapshot: ${slug}`)
        for (const file of files) {
          const source = await resolveArtifact(file.source, generation)
          const target = path.resolve(destination, slug, file.name)
          if (!isWithin(path.resolve(destination), target))
            throw new Error('Invalid artifact destination')
          await mkdir(path.dirname(target), { recursive: true })
          await copyFile(source, target)
        }
      }
    },
  }
}

/** Published unlisted posts have routes but are absent from navigation/search. */
export function publishedPosts(index: GlyphweaveContentIndex, listedOnly = false) {
  return index.posts
    .filter(
      (post) =>
        post.status === 'published' &&
        post.visibility !== 'private' &&
        (!listedOnly || post.visibility === 'public'),
    )
    .sort((a, b) => b.date.localeCompare(a.date))
}

/** Export only resources in the current publishable manifest. Never enumerate old generations. */
export async function exportGlyphweaveAssets(snapshot: GlyphweaveSnapshot, destination: string) {
  const root = snapshot.rootDir
  const target = path.resolve(root, destination)
  const rel = path.relative(root, target)
  if (!rel.startsWith(`public${path.sep}`) || rel.split(path.sep).includes('..'))
    throw new Error('Export destination must be below public/')
  // A source-controlled public tree is not owned by Glyphweave. Only replace our marked child.
  await mkdir(path.dirname(target), { recursive: true })
  if ((await realpath(path.dirname(target))) !== path.dirname(target))
    throw new Error('Export symlinks are not allowed')
  try {
    if ((await lstat(target)).isSymbolicLink())
      throw new Error('Export destination must not be a symlink')
    const entries = await readdir(target)
    if (entries.length && !entries.includes('.glyphweave-public'))
      throw new Error('Refusing to replace unowned public files')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
  const stage = `${target}.stage-${randomUUID()}`
  const backup = `${target}.backup-${randomUUID()}`
  await mkdir(stage)
  try {
    await snapshot.copyAssets(
      publishedPosts(snapshot.index).map((post) => post.slug),
      stage,
    )
    await writeFile(path.join(stage, '.glyphweave-public'), 'glyphweave')
    let backedUp = false
    try {
      await rename(target, backup)
      backedUp = true
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
    try {
      await rename(stage, target)
    } catch (error) {
      if (backedUp) await rename(backup, target)
      throw error
    }
    if (backedUp) await rm(backup, { recursive: true })
  } finally {
    await rm(stage, { recursive: true, force: true })
  }
}
