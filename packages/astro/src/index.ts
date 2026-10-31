import path from 'node:path'
import type { Loader } from 'astro/loaders'
import { openGlyphweaveSnapshot, type LoadedPost } from 'glyphweave/artifacts'
import type { GlyphweaveContentIndex } from 'glyphweave/schema'
import { createTaskQueue } from './task-queue.js'

type Post = GlyphweaveContentIndex['posts'][number]
export function glyphweaveLoader(options: {
  rootDir: string
  indexPath?: string
  transform?: (
    post: Post,
    loaded: LoadedPost,
    base: string,
  ) => {
    data: Record<string, unknown>
    html: string
    headings: { depth: number; text: string; slug: string }[]
  }
}): Loader {
  const indexPath = path.resolve(
    options.rootDir,
    options.indexPath ?? '.glyphweave/content-index.json',
  )
  return {
    name: 'glyphweave',
    load: async ({ store, parseData, generateDigest, watcher, logger, config }) => {
      const load = async () => {
        const snapshot = await openGlyphweaveSnapshot(options.rootDir, indexPath)
        const entries = []
        for (const post of snapshot.index.posts) {
          const loaded = snapshot.readPost(post.slug)
          const view = options.transform?.(post, loaded, config.base) ?? {
            data: post,
            html: loaded.contentHtml,
            headings: loaded.toc.map((item) => ({
              depth: item.depth,
              text: item.title,
              slug: item.id,
            })),
          }
          const data = await parseData({ id: post.slug, data: view.data })
          entries.push({
            id: post.slug,
            data,
            digest: generateDigest(
              JSON.stringify([loaded.manifest, data, view.html, view.headings]),
            ),
            rendered: { html: view.html, metadata: { headings: view.headings, frontmatter: data } },
          })
        }
        store.clear()
        for (const entry of entries) store.set(entry)
      }
      await load()
      const queue = createTaskQueue(load, (error) =>
        logger.error(`Glyphweave update failed; previous snapshot retained: ${String(error)}`),
      )
      watcher?.add(indexPath)
      const update = (file: string) => {
        if (path.resolve(file) === indexPath) void queue.enqueue()
      }
      for (const event of ['add', 'change', 'unlink'] as const) watcher?.on(event, update)
      watcher?.once('close', () => {
        void queue.stop()
      })
    },
  }
}
