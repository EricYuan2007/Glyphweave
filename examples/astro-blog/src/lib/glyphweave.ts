import { publishedPosts } from 'glyphweave'
import { openGlyphweaveSnapshot } from 'glyphweave/artifacts'
const root = process.cwd()
// One immutable snapshot per static build, shared by routes and listing pages.
const snapshot = openGlyphweaveSnapshot(root)
export async function getGlyphweavePosts(listedOnly = true) {
  return publishedPosts((await snapshot).index, listedOnly)
}
export async function getGlyphweavePost(slug: string) {
  const post = (await getGlyphweavePosts(false)).find((post) => post.slug === slug)
  if (!post) throw new Error(`Post not found: ${slug}`)
  return { ...(await snapshot).readPost(post.slug), ...post }
}
