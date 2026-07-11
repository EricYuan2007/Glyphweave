export {
  GlyphweaveConfigSchema,
  PostMetadataSchema,
  defaultConfig,
  defineConfig,
} from './config.js'
export type { GlyphweaveConfig, GlyphweavePostMetadata } from './config.js'

export {
  CaptureReportSchema,
  ContentIndexSchema,
  DiagnosticSchema,
  ManifestSchema,
  RewrittenAssetSchema,
  TocItemSchema,
} from './artifacts.js'
export type {
  GlyphweaveCaptureReport,
  GlyphweaveContentIndex,
  GlyphweaveDiagnostic,
  GlyphweaveManifest,
  RewrittenAsset,
  TocItem,
} from './artifacts.js'
