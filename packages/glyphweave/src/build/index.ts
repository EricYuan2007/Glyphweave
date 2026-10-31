export { buildDocuments, clean, resolvePostOutputDir } from './build.js'
export { buildAll, publishedPosts } from './build-all.js'
export type { BuildAllResult, BuildDocumentsResult, BuildDependencies, BuiltPost } from './build.js'
export { loadConfig } from './config.js'
export { discoverPosts, sha256 } from './discovery.js'
export type { DiscoveredTypstPost } from './discovery.js'
export { GLYPHWEAVE_VERSION } from './manifest.js'

export { defaultConfig, defineConfig } from '../schema/index.js'
export type {
  GlyphweaveConfig,
  GlyphweaveContentIndex,
  GlyphweaveManifest,
  GlyphweavePostMetadata,
  TocItem,
} from '../schema/index.js'

export { ownOutput as prepareOutput } from './output.js'

export { prepareNativeEngine } from './native-engine.js'
export { nativeRendererIdentity } from './fingerprint.js'

export { documentInput, type DocumentInput } from './document.js'
export { compilerEnvironment } from './environment.js'
