import type { Root, RootContent, Properties } from 'hast'
import type {
  GlyphweaveCaptureReport,
  GlyphweaveConfig,
  GlyphweaveDiagnostic,
  RewrittenAsset,
  TocItem,
} from '../schema/index.js'

export interface HtmlAdapterOptions {
  headingIds: 'preserve' | 'stable'
  scopeClass: string
}

export interface HtmlAdapterInput {
  rawHtmlPath: string
  post: { metadata: { slug: string }; sourcePath: string; postDir: string; assetDir?: string }
  outputDir: string
  publicBasePath: string
  options: HtmlAdapterOptions
  assets?: GlyphweaveConfig['assets']
  math?: GlyphweaveConfig['math']
  diagnostics?: GlyphweaveDiagnostic[]
}

export interface HtmlAdapterOutput {
  contentHtml: string
  toc: TocItem[]
  rewrittenAssets: RewrittenAsset[]
  warnings: string[]
  capture: GlyphweaveCaptureReport
  diagnostics: GlyphweaveDiagnostic[]
}

/** HAST union with optional conveniences for recursive, discriminant-checked transforms. */
export type HastNode = (Root | RootContent) & {
  tagName?: string
  value?: string
  properties?: Properties
  children?: HastNode[]
}
