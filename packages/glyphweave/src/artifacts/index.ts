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
} from '../schema/index.js'

/** Validate a build-time artifact snapshot; all paths in it belong to one committed generation. */
export async function readGlyphweaveContentIndex(
  rootDir: string,
  indexPath = '.glyphweave/content-index.json',
) {
  return ContentIndexSchema.parse(
    JSON.parse(await readFile(path.resolve(rootDir, indexPath), 'utf8')),
  )
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

async function artifactPath(rootDir: string, relative: string) {
  const root = await realpath(rootDir)
  const full = await realpath(path.resolve(root, relative))
  const rel = path.relative(root, full)
  if (!rel || rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel))
    throw new Error(`Artifact escapes project: ${relative}`)
  return full
}

export async function readGlyphweavePost(
  rootDir: string,
  post: GlyphweaveContentIndex['posts'][number],
) {
  const contentHtml = await readFile(await artifactPath(rootDir, post.contentHtmlPath), 'utf8')
  const toc = TocItemSchema.array().parse(
    JSON.parse(await readFile(await artifactPath(rootDir, post.tocPath), 'utf8')),
  )
  return { ...post, contentHtml, toc }
}

/** Export only resources in the current publishable manifest. Never enumerate old generations. */
export async function exportGlyphweaveAssets(
  rootDir: string,
  destination: string,
  indexPath?: string,
) {
  const root = await realpath(rootDir)
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
  const index = await readGlyphweaveContentIndex(root, indexPath)
  await mkdir(stage)
  try {
    await copyGlyphweaveAssets(
      root,
      publishedPosts(index),
      stage,
      path.dirname(path.resolve(root, indexPath ?? '.glyphweave/content-index.json')),
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

/** Copy exactly the host-selected documents into an empty, caller-owned staging directory. */
export async function copyGlyphweaveAssets(
  root: string,
  posts: GlyphweaveContentIndex['posts'],
  destination: string,
  artifactRoot: string,
): Promise<void> {
  destination = path.resolve(destination)
  const boundary = await realpath(artifactRoot)
  const containedArtifact = async (relative: string) => {
    const full = await artifactPath(root, relative)
    const rel = path.relative(boundary, full)
    if (!rel || rel.startsWith('..') || path.isAbsolute(rel))
      throw new Error('Artifact escapes generation root')
    return full
  }
  for (const post of posts) {
    const manifest = ManifestSchema.parse(
      JSON.parse(await readFile(await containedArtifact(post.manifestPath), 'utf8')),
    )
    if (manifest.slug !== post.slug) throw new Error('Manifest slug mismatch')
    const files = manifest.assets.map((asset) => {
      const relative = path.relative(
        path.join(path.dirname(manifest.html.contentPath), 'assets'),
        asset.output,
      )
      if (relative.startsWith('..') || path.isAbsolute(relative))
        throw new Error('Invalid manifest asset path')
      return { source: asset.output, name: `assets/${relative}` }
    })
    if (manifest.pdf.enabled && manifest.pdf.path)
      files.push({ source: manifest.pdf.path, name: 'article.pdf' })
    for (const file of files) {
      const output = path.resolve(destination, post.slug, file.name)
      if (
        !output.startsWith(`${destination}${path.sep}`) ||
        !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(post.slug)
      )
        throw new Error('Invalid artifact destination')
      await mkdir(path.dirname(output), { recursive: true })
      await copyFile(await containedArtifact(file.source), output)
    }
  }
}
