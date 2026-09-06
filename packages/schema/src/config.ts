import { z } from 'zod'

const localAbsolutePathPattern = /^(?:\/Users\/|\/home\/|~\/|file:\/\/|[A-Za-z]:\\)/

export const PostMetadataSchema = z.object({
  title: z.string().min(1),
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: z.string().min(1),
  date: z.string().date(),
  updated: z.string().date().optional(),
  tags: z.array(z.string()).default([]),
  status: z.enum(['draft', 'published', 'archived']),
  visibility: z.enum(['public', 'unlisted', 'private']),
  language: z.string().default('zh-CN'),
  pdf: z.boolean().optional(),
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

// Resolve profile defaults once; explicit font choices remain authoritative.
export const PdfTemplateSchema = z
  .object({
    enabled: z.boolean().default(true),
    profile: z.enum(['editorial', 'portable']).default('editorial'),
    fonts: z.array(z.string().trim().min(1)).min(1).optional(),
    latinFonts: z.array(z.string().trim().min(1)).default(['Libertinus Serif']),
    headingFonts: z.array(z.string().trim().min(1)).min(1).optional(),
    monoFonts: z.array(z.string().trim().min(1)).min(1).optional(),
    fontSize: z.number().finite().min(8).max(14).default(10.5),
    lang: z.string().default('zh'),
    region: z.string().default('CN'),
  })
  .transform((value) => ({
    ...value,
    fonts:
      value.fonts ??
      (value.profile === 'portable'
        ? ['Noto Serif CJK SC']
        : ['Songti SC', 'Noto Serif CJK SC', 'STSong', 'PingFang SC']),
    headingFonts:
      value.headingFonts ??
      (value.profile === 'portable'
        ? ['Noto Sans CJK SC']
        : ['PingFang SC', 'Noto Sans CJK SC', 'Heiti SC', 'STHeiti']),
    monoFonts:
      value.monoFonts ??
      (value.profile === 'portable' ? ['DejaVu Sans Mono'] : ['Menlo', 'DejaVu Sans Mono']),
  }))
  .default({})

export const GlyphweaveConfigSchema = z
  .object({
    content: z
      .object({
        root: z.string().default('content/typst-posts'),
        pattern: z.string().default('*/post.yaml'),
      })
      .strict()
      .default({}),
    output: z
      .object({
        root: z.string().default('.glyphweave'),
        publicBasePath: z.string().default('/glyphweave'),
      })
      .strict()
      .default({}),
    typst: z
      .object({
        binary: z.string().default('typst'),
        htmlFeatures: z.literal(true).default(true),
        pdf: z
          .object({
            enabledByDefault: z.boolean().default(false),
            failure: z.enum(['error', 'warn']).default('error'),
            template: PdfTemplateSchema,
          })
          .default({}),
      })
      .strict()
      .default({}),
    html: z
      .object({
        sanitize: z.literal(true).default(true),
        headingIds: z.enum(['preserve', 'stable']).default('preserve'),
        scopeClass: z
          .string()
          .regex(/^[a-zA-Z_][a-zA-Z0-9_-]*$/)
          .default('glyphweave-content'),
      })
      .strict()
      .default({}),
    math: z
      .object({
        strategy: z.enum(['mathml', 'svg-frame']).default('mathml'),
        svg: z
          .object({
            includeSourceFallback: z.boolean().default(true),
            inlineVerticalShift: z.string().default('0.08em'),
          })
          .strict()
          .default({}),
      })
      .strict()
      .default({}),
    capture: z
      .object({
        strict: z.boolean().default(true),
        report: z.literal(true).default(true),
      })
      .strict()
      .default({}),
    assets: z
      .object({
        copy: z.literal(true).default(true),
        allowedExtensions: z
          .array(z.string())
          .default(['.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif', '.pdf']),
      })
      .strict()
      .default({}),
    cache: z
      .object({
        enabled: z.boolean().default(true),
      })
      .strict()
      .default({}),
  })
  .strict()
  .default({})

export type GlyphweaveConfig = z.infer<typeof GlyphweaveConfigSchema>
export type GlyphweavePostMetadata = z.infer<typeof PostMetadataSchema>

export function defaultConfig(): GlyphweaveConfig {
  return GlyphweaveConfigSchema.parse({})
}

export function defineConfig(config: z.input<typeof GlyphweaveConfigSchema>): GlyphweaveConfig {
  return GlyphweaveConfigSchema.parse(config)
}
