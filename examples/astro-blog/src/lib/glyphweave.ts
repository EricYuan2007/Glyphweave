import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { GlyphweaveContentIndex, TocItem } from '@glyphweave/schema'

const root = process.cwd()

export type GlyphweavePostData = GlyphweaveContentIndex['posts'][number] & {
  contentHtml: string
  toc: TocItem[]
}

export async function getGlyphweavePosts(): Promise<GlyphweaveContentIndex['posts']> {
  const index = JSON.parse(
    await readFile(path.join(root, '.glyphweave/content-index.json'), 'utf-8'),
  ) as GlyphweaveContentIndex
  return index.posts
    .filter((post) => post.status === 'published' && post.visibility !== 'private')
    .sort((a, b) => b.date.localeCompare(a.date))
}

export async function getGlyphweavePost(slug: string): Promise<GlyphweavePostData> {
  const post = (await getGlyphweavePosts()).find((entry) => entry.slug === slug)
  if (!post) throw new Error(`Post not found: ${slug}`)
  const contentHtml = await readFile(path.join(root, post.contentHtmlPath), 'utf-8')
  const toc = JSON.parse(await readFile(path.join(root, post.tocPath), 'utf-8')) as TocItem[]
  return { ...post, contentHtml, toc }
}
