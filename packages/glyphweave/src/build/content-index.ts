import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import {
  ContentIndexSchema,
  type GlyphweaveConfig,
  type GlyphweaveContentIndex,
} from '../schema/index.js'
import type { BuiltPost } from './types.js'

export async function writeContentIndex(
  rootDir: string,
  config: GlyphweaveConfig,
  built: BuiltPost[],
  cachePath: string,
  outputRoot: string,
) {
  const posts: GlyphweaveContentIndex['posts'] = built.map(({ post, manifest }) => {
    const pdfPath = manifest.pdf.path
    return {
      id: post.id,
      data: post.data,
      contentHtmlPath: manifest.html.contentPath,
      tocPath: manifest.html.tocPath,
      pdfPath,
      publicPdfPath: pdfPath
        ? `${config.output.publicBasePath.replace(/\/$/, '')}/posts/${post.id}/article.pdf`
        : null,
      manifestPath: path.posix.join(
        config.output.root,
        'generated/posts',
        post.id,
        'manifest.json',
      ),
    }
  })
  const index: GlyphweaveContentIndex = { schemaVersion: 2, posts, cachePath, outputRoot }
  const outputPath = path.resolve(rootDir, config.output.root, 'content-index.json')
  await mkdir(path.dirname(outputPath), { recursive: true })
  await writeFile(outputPath, JSON.stringify(ContentIndexSchema.parse(index), null, 2))
}
