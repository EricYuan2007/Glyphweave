import type { Root, RootContent } from 'hast'
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
  post: { id: string; sourcePath: string; postDir: string; assetDir?: string }
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

export type HastNode = Root | RootContent
