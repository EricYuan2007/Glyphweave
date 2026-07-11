import { z } from 'zod'

export const TocItemSchema = z.object({
  depth: z.number().int().min(1).max(6),
  title: z.string(),
  id: z.string(),
})

export const RewrittenAssetSchema = z.object({
  source: z.string(),
  output: z.string(),
  publicPath: z.string(),
})

export const DiagnosticSchema = z.object({
  code: z.string(),
  severity: z.enum(['info', 'warning', 'error']),
  message: z.string(),
  source: z.string().optional(),
  line: z.number().int().positive().optional(),
})

export const CaptureReportSchema = z.object({
  status: z.enum(['ok', 'warning', 'failed']),
  content: z.object({
    headings: z.number().int().nonnegative(),
    paragraphs: z.number().int().nonnegative(),
    lists: z.number().int().nonnegative(),
    tables: z.number().int().nonnegative(),
    images: z.number().int().nonnegative(),
    codeBlocks: z.number().int().nonnegative(),
    footnotes: z.number().int().nonnegative(),
    frames: z.number().int().nonnegative(),
  }),
  math: z.object({
    sourceFormulaCount: z.number().int().nonnegative(),
    renderedCount: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
    inline: z.number().int().nonnegative(),
    block: z.number().int().nonnegative(),
    nativeMathml: z.number().int().nonnegative(),
    typstFrameSvg: z.number().int().nonnegative(),
    sourceFallbacks: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
    mismatch: z.boolean(),
  }),
})

export const ManifestSchema = z.object({
  schemaVersion: z.literal(2),
  generator: z.literal('glyphweave'),
  generatorVersion: z.string(),
  typstVersion: z.string(),
  typst: z.object({
    version: z.string(),
    features: z.array(z.string()),
    mathRenderer: z.enum(['mathml', 'svg-frame']),
    preludeVersion: z.string().nullable(),
    pdfPreludeVersion: z.string().nullable(),
  }),
  slug: z.string(),
  sourcePath: z.string(),
  metadataPath: z.string(),
  sourceHash: z.string(),
  metadataHash: z.string(),
  html: z.object({
    rawPath: z.string(),
    contentPath: z.string(),
    tocPath: z.string(),
  }),
  pdf: z.object({
    enabled: z.boolean(),
    path: z.string().nullable(),
  }),
  assets: z.array(RewrittenAssetSchema),
  capture: CaptureReportSchema,
  diagnostics: z.array(DiagnosticSchema),
  createdAt: z.string(),
})

export const ContentIndexSchema = z.object({
  schemaVersion: z.literal(1),
  posts: z.array(
    z.object({
      id: z.string(),
      slug: z.string(),
      title: z.string(),
      description: z.string(),
      date: z.string(),
      updated: z.string().optional(),
      tags: z.array(z.string()),
      status: z.enum(['draft', 'published', 'archived']),
      visibility: z.enum(['public', 'unlisted', 'private']),
      language: z.string(),
      contentHtmlPath: z.string(),
      tocPath: z.string(),
      pdfPath: z.string().nullable(),
      publicPdfPath: z.string().nullable(),
      manifestPath: z.string(),
    }),
  ),
})

export type TocItem = z.infer<typeof TocItemSchema>
export type RewrittenAsset = z.infer<typeof RewrittenAssetSchema>
export type GlyphweaveDiagnostic = z.infer<typeof DiagnosticSchema>
export type GlyphweaveCaptureReport = z.infer<typeof CaptureReportSchema>
export type GlyphweaveManifest = z.infer<typeof ManifestSchema>
export type GlyphweaveContentIndex = z.infer<typeof ContentIndexSchema>
