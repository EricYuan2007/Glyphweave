import { publishedPosts, readGlyphweaveContentIndex, readGlyphweavePost } from '@glyphweave/astro'
const root = process.cwd()
// One immutable snapshot per static build, shared by routes and listing pages.
const snapshot = readGlyphweaveContentIndex(root)
export async function getGlyphweavePosts(listedOnly = true) {
  return publishedPosts(await snapshot, listedOnly)
}
export async function getGlyphweavePost(slug: string) {
  const post = (await getGlyphweavePosts(false)).find((post) => post.slug === slug)
  if (!post) throw new Error(`Post not found: ${slug}`)
  return readGlyphweavePost(root, post)
}
