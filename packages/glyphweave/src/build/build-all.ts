import { PostMetadataSchema } from '../schema/index.js'
import { defaultConfig } from '../schema/index.js'
import { buildDocuments } from './build.js'
import { discoverPosts, type DiscoveredTypstPost } from './discovery.js'
import type { BuildDependencies } from './types.js'

/** Standalone publishing policy. The document compiler does not select publication states. */
export async function buildAll(root: string, config = defaultConfig(), deps?: BuildDependencies) {
  let skipped: DiscoveredTypstPost[] = []
  const result = await buildDocuments(
    root,
    config,
    async () => {
      const posts = await discoverPosts(root, config)
      const published = (post: DiscoveredTypstPost) =>
        post.metadata.visibility !== 'private' && post.metadata.status === 'published'
      skipped = posts.filter((post) => !published(post))
      return posts.filter(published)
    },
    deps,
  )
  return { ...result, skipped }
}

export function publishedPosts(
  index: import('../schema/index.js').GlyphweaveContentIndex,
  listedOnly = false,
) {
  return index.posts
    .map((post) => ({ ...post, ...PostMetadataSchema.parse(post.data) }))
    .filter(
      (post) =>
        post.status === 'published' &&
        post.visibility !== 'private' &&
        (!listedOnly || post.visibility === 'public'),
    )
    .sort((a, b) => b.date.localeCompare(a.date))
}
