import { isWithin } from '../paths.js'
import { createHash } from 'node:crypto'
import { readFile, realpath } from 'node:fs/promises'
import path from 'node:path'
import { glob } from 'tinyglobby'
import YAML from 'yaml'
import {
  PostMetadataSchema,
  type GlyphweaveConfig,
  type GlyphweavePostMetadata,
} from '../schema/index.js'

export interface DiscoveredTypstPost {
  metadata: GlyphweavePostMetadata
  postDir: string
  metadataPath: string
  sourcePath: string
  assetDir?: string
  sourceHash: string
  metadataHash: string
}

export async function discoverPosts(
  rootDir: string,
  config: GlyphweaveConfig,
): Promise<DiscoveredTypstPost[]> {
  const contentRoot = path.resolve(await realpath(rootDir), config.content.root)
  const metadataPaths = await glob(config.content.pattern, {
    cwd: contentRoot,
    absolute: true,
    onlyFiles: true,
    expandDirectories: false,
  })
  const posts = await Promise.all(
    metadataPaths.sort().map(async (metadataPath) => {
      const rawMetadata = await readFile(metadataPath, 'utf-8')
      const metadata = PostMetadataSchema.parse(YAML.parse(rawMetadata))
      const postDir = path.dirname(metadataPath)
      const sourcePath = path.resolve(postDir, metadata.source ?? 'index.typ')
      const actualSource = await realpath(sourcePath)
      const actualPost = await realpath(postDir)
      if (!isWithin(actualPost, actualSource))
        throw new Error(`Source escapes post directory: ${metadata.source}`)
      const source = await readFile(sourcePath, 'utf-8')
      return {
        metadata,
        postDir,
        metadataPath,
        sourcePath,
        assetDir: path.join(postDir, 'assets'),
        sourceHash: sha256(source),
        metadataHash: sha256(rawMetadata),
      } satisfies DiscoveredTypstPost
    }),
  )
  const seen = new Set<string>()
  for (const post of posts) {
    if (seen.has(post.metadata.slug)) throw new Error(`Duplicate post slug: ${post.metadata.slug}`)
    seen.add(post.metadata.slug)
  }
  return posts
}

export function sha256(value: string | Buffer) {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`
}
