import type { DiscoveredTypstPost } from '@glyphweave/core'
import type {
  GlyphweaveCaptureReport,
  GlyphweaveConfig,
  GlyphweaveDiagnostic,
  RewrittenAsset,
  TocItem,
} from '@glyphweave/schema'

export interface HtmlAdapterOptions {
  sanitize: boolean
  headingIds: 'preserve' | 'stable'
  scopeClass: string
}

export interface HtmlAdapterInput {
  rawHtmlPath: string
  post: DiscoveredTypstPost
  outputDir: string
  publicBasePath: string
  options: HtmlAdapterOptions
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

export interface HastNode {
  type: string
  tagName?: string
  value?: string
  properties?: Record<string, unknown>
  children?: HastNode[]
}
