import { documentInput, type DocumentInput } from './document.js'
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

export interface DiscoveredTypstPost extends DocumentInput {
  metadata: GlyphweavePostMetadata
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
      return {
        ...(await documentInput({
          id: metadata.slug,
          sourcePath,
          metadataPath,
          directory: postDir,
          creationTimestamp: Math.floor(Date.parse(metadata.updated ?? metadata.date) / 1000),
          pdf: metadata.pdf ?? config.typst.pdf.enabledByDefault,
          data: metadata,
        })),
        metadata,
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
