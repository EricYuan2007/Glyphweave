import { z } from 'zod'

const localAbsolutePathPattern = /^(?:\/Users\/|\/home\/|~\/|file:\/\/|[A-Za-z]:\\)/

export const PostMetadataSchema = z.object({
  title: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: z.string().min(1),
  date: z.string().min(1),
  updated: z.string().optional(),
  tags: z.array(z.string()).default([]),
  status: z.enum(['draft', 'published', 'archived']),
  visibility: z.enum(['public', 'unlisted', 'private']),
  language: z.string().default('zh-CN'),
  pdf: z.boolean().default(false),
  source: z.string().default('index.typ'),
  cover: z
    .string()
    .nullable()
    .optional()
    .refine((value) => value == null || !localAbsolutePathPattern.test(value), {
      message: 'cover must not be a local absolute path',
    })
    .default(null),
  canonicalUrl: z.string().url().nullable().optional().default(null),
})

export const GlyphweaveConfigSchema = z
  .object({
    content: z
      .object({
        root: z.string().default('content/typst-posts'),
        pattern: z.string().default('*/post.yaml'),
      })
      .default({}),
    output: z
      .object({
        root: z.string().default('.glyphweave'),
        publicBasePath: z.string().default('/glyphweave'),
      })
      .default({}),
    typst: z
      .object({
        binary: z.string().default('typst'),
        htmlFeatures: z.boolean().default(true),
        wrapper: z
          .object({
            injectPrelude: z.boolean().default(true),
          })
          .default({}),
        pdf: z
          .object({
            enabledByDefault: z.boolean().default(false),
            failure: z.enum(['error', 'warn']).default('error'),
          })
          .default({}),
      })
      .default({}),
    html: z
      .object({
        sanitize: z.boolean().default(true),
        headingIds: z.enum(['preserve', 'stable']).default('stable'),
        scopeClass: z.string().default('glyphweave-content'),
      })
      .default({}),
    math: z
      .object({
        strategy: z.enum(['typst-frame', 'hybrid', 'native-only', 'disabled']).default('hybrid'),
        failOnIgnoredEquation: z.boolean().default(true),
        includeSourceFallback: z.boolean().default(true),
        inlineVerticalShift: z.string().default('0.08em'),
      })
      .default({}),
    capture: z
      .object({
        strict: z.boolean().default(true),
        report: z.boolean().default(true),
      })
      .default({}),
    assets: z
      .object({
        copy: z.boolean().default(true),
        allowedExtensions: z
          .array(z.string())
          .default(['.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif', '.pdf']),
      })
      .default({}),
    cache: z
      .object({
        enabled: z.boolean().default(true),
      })
      .default({}),
  })
  .default({})

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
    outputMathFrameCount: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
    inline: z.number().int().nonnegative(),
    block: z.number().int().nonnegative(),
    nativeMathml: z.number().int().nonnegative(),
    mathmlRecovered: z.number().int().nonnegative(),
    typstFrameSvg: z.number().int().nonnegative(),
    sourceFallbacks: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
    mismatch: z.boolean(),
  }),
})

export const ManifestSchema = z.object({
  schemaVersion: z.literal(1),
  generator: z.literal('glyphweave'),
  generatorVersion: z.string(),
  typstVersion: z.string(),
  typst: z.object({
    version: z.string(),
    features: z.array(z.string()),
    preludeVersion: z.string().nullable(),
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

export type GlyphweaveConfig = z.infer<typeof GlyphweaveConfigSchema>
export type GlyphweavePostMetadata = z.infer<typeof PostMetadataSchema>
export type TocItem = z.infer<typeof TocItemSchema>
export type RewrittenAsset = z.infer<typeof RewrittenAssetSchema>
export type GlyphweaveDiagnostic = z.infer<typeof DiagnosticSchema>
export type GlyphweaveCaptureReport = z.infer<typeof CaptureReportSchema>
export type GlyphweaveManifest = z.infer<typeof ManifestSchema>
export type GlyphweaveContentIndex = z.infer<typeof ContentIndexSchema>

export function defaultConfig(): GlyphweaveConfig {
  return GlyphweaveConfigSchema.parse({})
}

export function defineConfig(config: unknown): GlyphweaveConfig {
  return GlyphweaveConfigSchema.parse(config)
}
