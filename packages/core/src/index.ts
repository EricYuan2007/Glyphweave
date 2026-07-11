export { buildAll, clean, resolvePostOutputDir } from './build.js'
export type { BuildAllResult, BuildDependencies, BuiltPost } from './build.js'
export { loadConfig } from './config.js'
export { discoverPosts, sha256 } from './discovery.js'
export type { DiscoveredTypstPost } from './discovery.js'
export { GLYPHWEAVE_VERSION } from './manifest.js'

export { defaultConfig, defineConfig } from '@glyphweave/schema'
export type {
  GlyphweaveConfig,
  GlyphweaveContentIndex,
  GlyphweaveManifest,
  GlyphweavePostMetadata,
  TocItem,
} from '@glyphweave/schema'
