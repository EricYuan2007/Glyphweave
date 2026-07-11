import path from 'node:path'
import type {
  GlyphweaveCaptureReport,
  GlyphweaveConfig,
  GlyphweaveDiagnostic,
  GlyphweaveManifest,
} from '@glyphweave/schema'
import {
  GLYPHWEAVE_HTML_PRELUDE_VERSION,
  GLYPHWEAVE_PDF_PRELUDE_VERSION,
} from '@glyphweave/typst'
import type { DiscoveredTypstPost } from './discovery.js'

export const GLYPHWEAVE_VERSION = '0.1.0'

export function expectedPreludeVersion(config: GlyphweaveConfig) {
  return config.math.strategy === 'svg-frame' ? GLYPHWEAVE_HTML_PRELUDE_VERSION : null
}

export function expectedPdfPreludeVersion(config: GlyphweaveConfig) {
  return config.typst.pdf.template.enabled ? GLYPHWEAVE_PDF_PRELUDE_VERSION : null
}

export function createManifest(
  rootDir: string,
  config: GlyphweaveConfig,
  post: DiscoveredTypstPost,
  typstVersion: string,
  preludeVersion: string | null,
  pdfPreludeVersion: string | null,
  assets: GlyphweaveManifest['assets'],
  capture: GlyphweaveCaptureReport,
  diagnostics: GlyphweaveDiagnostic[],
  paths: { rawPath: string; contentPath: string; tocPath: string; pdfPath: string | null },
): GlyphweaveManifest {
  return {
    schemaVersion: 2,
    generator: 'glyphweave',
    generatorVersion: GLYPHWEAVE_VERSION,
    typstVersion,
    typst: {
      version: typstVersion,
      features: config.typst.htmlFeatures
        ? config.math.strategy === 'mathml' ? ['html', 'mathml'] : ['html']
        : [],
      mathRenderer: config.math.strategy,
      preludeVersion,
      pdfPreludeVersion: paths.pdfPath ? pdfPreludeVersion : null,
    },
    slug: post.metadata.slug,
    sourcePath: relative(rootDir, post.sourcePath),
    metadataPath: relative(rootDir, post.metadataPath),
    sourceHash: post.sourceHash,
    metadataHash: post.metadataHash,
    html: {
      rawPath: relative(rootDir, paths.rawPath),
      contentPath: relative(rootDir, paths.contentPath),
      tocPath: relative(rootDir, paths.tocPath),
    },
    pdf: { enabled: paths.pdfPath !== null, path: paths.pdfPath ? relative(rootDir, paths.pdfPath) : null },
    assets: assets.map((asset) => ({
      source: relative(rootDir, asset.source),
      output: relative(rootDir, asset.output),
      publicPath: asset.publicPath,
    })),
    capture,
    diagnostics,
    createdAt: new Date().toISOString(),
  }
}

export function assertCapture(config: GlyphweaveConfig, capture: GlyphweaveCaptureReport) {
  if (!config.capture.strict) return
  if (capture.math.failed === 0 && !capture.math.mismatch && capture.status !== 'failed') return
  throw new Error(
    `Strict capture failed: ${capture.math.failed} formula(s) missing, mismatch=${capture.math.mismatch}`,
  )
}

function relative(rootDir: string, target: string) {
  return path.relative(rootDir, target).replace(/\\/g, '/')
}
