import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import {
  ContentIndexSchema,
  type GlyphweaveConfig,
  type GlyphweaveContentIndex,
} from '@glyphweave/schema'
import type { BuiltPost } from './build.js'

export async function writeContentIndex(
  rootDir: string,
  config: GlyphweaveConfig,
  built: BuiltPost[],
  cachePath?: string,
) {
  const posts: GlyphweaveContentIndex['posts'] = built.map(({ post, manifest }) => {
    const pdfPath = manifest.pdf.path
    return {
      id: post.metadata.slug,
      slug: post.metadata.slug,
      title: post.metadata.title,
      description: post.metadata.description,
      date: post.metadata.date,
      updated: post.metadata.updated,
      tags: post.metadata.tags,
      status: post.metadata.status,
      visibility: post.metadata.visibility,
      language: post.metadata.language ?? 'zh-CN',
      cover: post.metadata.cover,
      canonicalUrl: post.metadata.canonicalUrl,
      contentHtmlPath: manifest.html.contentPath,
      tocPath: manifest.html.tocPath,
      pdfPath,
      publicPdfPath: pdfPath
        ? `${config.output.publicBasePath.replace(/\/$/, '')}/posts/${post.metadata.slug}/article.pdf`
        : null,
      manifestPath: path.posix.join(
        config.output.root,
        'generated/posts',
        post.metadata.slug,
        'manifest.json',
      ),
    }
  })
  const index: GlyphweaveContentIndex = { schemaVersion: 1, posts, cachePath }
  const outputPath = path.resolve(rootDir, config.output.root, 'content-index.json')
  await mkdir(path.dirname(outputPath), { recursive: true })
  await writeFile(outputPath, JSON.stringify(ContentIndexSchema.parse(index), null, 2))
}
