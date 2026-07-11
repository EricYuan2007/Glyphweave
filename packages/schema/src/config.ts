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
        pdf: z
          .object({
            enabledByDefault: z.boolean().default(false),
            failure: z.enum(['error', 'warn']).default('error'),
            template: z
              .object({
                enabled: z.boolean().default(true),
                fonts: z
                  .array(z.string().min(1))
                  .default([
                    'Songti SC',
                    'STSong',
                    'PingFang SC',
                  ]),
                monoFonts: z.array(z.string().min(1)).default(['Menlo']),
                lang: z.string().default('zh'),
                region: z.string().default('CN'),
              })
              .default({}),
          })
          .default({}),
      })
      .strict()
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

export type GlyphweaveConfig = z.infer<typeof GlyphweaveConfigSchema>
export type GlyphweavePostMetadata = z.infer<typeof PostMetadataSchema>

export function defaultConfig(): GlyphweaveConfig {
  return GlyphweaveConfigSchema.parse({})
}

export function defineConfig(config: unknown): GlyphweaveConfig {
  return GlyphweaveConfigSchema.parse(config)
}
