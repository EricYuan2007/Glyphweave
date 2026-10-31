import type { BuildContext } from './context.js'
import path from 'node:path'
import { readFileSync } from 'node:fs'
import type {
  GlyphweaveCaptureReport,
  GlyphweaveConfig,
  GlyphweaveDiagnostic,
  GlyphweaveManifest,
} from '../schema/index.js'
import {
  GLYPHWEAVE_HTML_PRELUDE_VERSION,
  GLYPHWEAVE_PDF_PRELUDE_VERSION,
} from '../compiler/index.js'
import type { DocumentInput } from './document.js'

export const GLYPHWEAVE_VERSION: string = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
).version

export function expectedPreludeVersion(config: GlyphweaveConfig) {
  return config.math.strategy !== 'mathml' ? GLYPHWEAVE_HTML_PRELUDE_VERSION : null
}

export function expectedPdfPreludeVersion(config: GlyphweaveConfig) {
  return config.typst.pdf.template.enabled ? GLYPHWEAVE_PDF_PRELUDE_VERSION : null
}

export function createManifest(
  context: BuildContext,
  input: {
    post: DocumentInput
    preludeVersion: string | null
    assets: GlyphweaveManifest['assets']
    capture: GlyphweaveCaptureReport
    diagnostics: GlyphweaveDiagnostic[]
    paths: { rawPath: string; contentPath: string; tocPath: string; pdfPath: string | null }
  },
): GlyphweaveManifest {
  const { rootDir, config, typstVersion } = context
  const { post, preludeVersion, assets, capture, diagnostics, paths } = input
  return {
    schemaVersion: 2,
    generator: 'glyphweave',
    generatorVersion: GLYPHWEAVE_VERSION,
    typstVersion,
    typst: {
      version: typstVersion,
      features: config.math.strategy === 'mathml' ? ['html', 'mathml'] : ['html'],
      mathRenderer: config.math.strategy,
      preludeVersion,
      pdfPreludeVersion: paths.pdfPath ? expectedPdfPreludeVersion(config) : null,
    },
    slug: post.id,
    sourcePath: relative(rootDir, post.sourcePath),
    metadataPath: relative(rootDir, post.metadataPath),
    sourceHash: post.sourceHash,
    metadataHash: post.metadataHash,
    html: {
      rawPath: relative(rootDir, paths.rawPath),
      contentPath: relative(rootDir, paths.contentPath),
      tocPath: relative(rootDir, paths.tocPath),
    },
    pdf: {
      enabled: paths.pdfPath !== null,
      path: paths.pdfPath ? relative(rootDir, paths.pdfPath) : null,
    },
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
  if (capture.status !== 'failed') return
  throw new Error(
    `Strict capture failed: ${capture.math.failed} formula(s) missing, mismatch=${capture.math.mismatch}`,
  )
}

function relative(rootDir: string, target: string) {
  return path.relative(rootDir, target).replace(/\\/g, '/')
}
