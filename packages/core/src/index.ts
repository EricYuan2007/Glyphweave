import { createHash } from 'node:crypto'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import fastGlob from 'fast-glob'
import YAML from 'yaml'
import { adaptTypstHtml } from '@glyphweave/html-adapter'
import {
  GlyphweaveConfigSchema,
  PostMetadataSchema,
  defaultConfig,
  type GlyphweaveConfig,
  type GlyphweaveCaptureReport,
  type GlyphweaveDiagnostic,
  type GlyphweaveContentIndex,
  type GlyphweaveManifest,
  type GlyphweavePostMetadata,
} from '@glyphweave/schema'
import {
  GLYPHWEAVE_HTML_PRELUDE_VERSION,
  compileTypstHtml,
  compileTypstPdf,
  detectTypst,
  type CompileInput,
  type CompileOutput,
  type TypstInfo,
} from '@glyphweave/typst'

export { defaultConfig, defineConfig } from '@glyphweave/schema'
export type {
  GlyphweaveConfig,
  GlyphweaveContentIndex,
  GlyphweaveManifest,
  GlyphweavePostMetadata,
  TocItem,
} from '@glyphweave/schema'

export const GLYPHWEAVE_VERSION = '0.1.0'

export interface DiscoveredTypstPost {
  metadata: GlyphweavePostMetadata
  postDir: string
  metadataPath: string
  sourcePath: string
  assetDir?: string
  sourceHash: string
  metadataHash: string
}

export interface BuildDependencies {
  typstInfo: (binary: string) => Promise<TypstInfo>
  compileHtml: (input: CompileInput) => Promise<CompileOutput>
  compilePdf: (input: CompileInput) => Promise<CompileOutput>
}

export interface BuildAllResult {
  built: BuiltPost[]
  skipped: DiscoveredTypstPost[]
}

export interface BuiltPost {
  post: DiscoveredTypstPost
  manifest: GlyphweaveManifest
}

const defaultBuildDependencies: BuildDependencies = {
  typstInfo: detectTypst,
  compileHtml: compileTypstHtml,
  compilePdf: compileTypstPdf,
}

export async function loadConfig(rootDir: string, configPath = 'glyphweave.config.ts') {
  const fullPath = path.resolve(rootDir, configPath)
  try {
    const mod = await import(`${pathToFileURL(fullPath).href}?t=${Date.now()}`)
    return GlyphweaveConfigSchema.parse(mod.default ?? mod.config ?? {})
  } catch (error: any) {
    if (error?.code === 'ERR_MODULE_NOT_FOUND' || error?.code === 'MODULE_NOT_FOUND') {
      return defaultConfig()
    }
    if (error?.code === 'ENOENT') {
      return defaultConfig()
    }
    throw error
  }
}

export async function discoverPosts(
  rootDir: string,
  config: GlyphweaveConfig,
): Promise<DiscoveredTypstPost[]> {
  const contentRoot = path.resolve(rootDir, config.content.root)
  const metadataPaths = await fastGlob(config.content.pattern, {
    cwd: contentRoot,
    absolute: true,
    onlyFiles: true,
  })

  const posts = await Promise.all(
    metadataPaths.sort().map(async (metadataPath) => {
      const rawMetadata = await readFile(metadataPath, 'utf-8')
      const metadata = PostMetadataSchema.parse(YAML.parse(rawMetadata))
      const postDir = path.dirname(metadataPath)
      const sourcePath = path.resolve(postDir, metadata.source ?? 'index.typ')
      const source = await readFile(sourcePath, 'utf-8')
      return {
        metadata,
        postDir,
        metadataPath,
        sourcePath,
        assetDir: path.join(postDir, 'assets'),
        sourceHash: sha256(source),
        metadataHash: sha256(rawMetadata),
      } satisfies DiscoveredTypstPost
    }),
  )

  const seen = new Set<string>()
  for (const post of posts) {
    if (seen.has(post.metadata.slug)) {
      throw new Error(`Duplicate post slug: ${post.metadata.slug}`)
    }
    seen.add(post.metadata.slug)
  }

  return posts
}

export async function buildAll(
  rootDir: string,
  config = defaultConfig(),
  deps: BuildDependencies = defaultBuildDependencies,
): Promise<BuildAllResult> {
  const posts = await discoverPosts(rootDir, config)
  const outputRoot = path.resolve(rootDir, config.output.root)
  const typst = await deps.typstInfo(config.typst.binary)
  const built: BuiltPost[] = []
  const skipped: DiscoveredTypstPost[] = []

  for (const post of posts) {
    if (post.metadata.visibility === 'private' || post.metadata.status === 'archived') {
      skipped.push(post)
      continue
    }

    const outputDir = resolvePostOutputDir(rootDir, config, post.metadata.slug)
    const logDir = path.join(outputRoot, 'logs')
    await mkdir(outputDir, { recursive: true })

    const rawPath = path.join(outputDir, 'raw.html')
    const contentPath = path.join(outputDir, 'content.html')
    const tocPath = path.join(outputDir, 'toc.json')
    const manifestPath = path.join(outputDir, 'manifest.json')

    const htmlCompile = await deps.compileHtml({
      binary: config.typst.binary,
      inputPath: post.sourcePath,
      outputPath: rawPath,
      cwd: post.postDir,
      rootPath: post.postDir,
      wrapper: {
        injectPrelude: config.typst.wrapper.injectPrelude,
        mathStrategy: config.math.strategy,
      },
      logPath: path.join(logDir, `${post.metadata.slug}.html.log`),
    })
    assertHtmlDiagnostics(config, htmlCompile.diagnostics ?? [])

    const adapted = await adaptTypstHtml({
      rawHtmlPath: rawPath,
      post,
      outputDir,
      publicBasePath: config.output.publicBasePath,
      options: config.html,
      math: config.math,
      diagnostics: htmlCompile.diagnostics ?? [],
    })
    assertCapture(config, adapted.capture)

    await writeFile(contentPath, adapted.contentHtml)
    await writeFile(tocPath, JSON.stringify(adapted.toc, null, 2))

    const pdfEnabled = post.metadata.pdf ?? config.typst.pdf.enabledByDefault
    let pdfPath: string | null = null
    if (pdfEnabled) {
      pdfPath = path.join(outputDir, 'article.pdf')
      try {
        await deps.compilePdf({
          binary: config.typst.binary,
          inputPath: post.sourcePath,
          outputPath: pdfPath,
          cwd: post.postDir,
          logPath: path.join(logDir, `${post.metadata.slug}.pdf.log`),
        })
      } catch (error) {
        if (config.typst.pdf.failure === 'error') throw error
        pdfPath = null
      }
    }

    const manifest = createManifest(
      rootDir,
      config,
      post,
      typst.version,
      htmlCompile.preludeVersion ?? expectedPreludeVersion(config),
      adapted.rewrittenAssets,
      adapted.capture,
      adapted.diagnostics,
      {
        rawPath,
        contentPath,
        tocPath,
        pdfPath,
      },
    )
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2))
    built.push({ post, manifest })
  }

  await writeContentIndex(rootDir, config, built)
  return { built, skipped }
}

function expectedPreludeVersion(config: GlyphweaveConfig) {
  if (!config.typst.wrapper.injectPrelude) return null
  if (config.math.strategy === 'disabled' || config.math.strategy === 'native-only') return null
  return GLYPHWEAVE_HTML_PRELUDE_VERSION
}

export async function clean(rootDir: string, config = defaultConfig()) {
  await rm(path.resolve(rootDir, config.output.root), { recursive: true, force: true })
}

export function resolvePostOutputDir(rootDir: string, config: GlyphweaveConfig, slug: string) {
  return path.resolve(rootDir, config.output.root, 'generated/posts', slug)
}

export function sha256(value: string | Buffer) {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`
}

function createManifest(
  rootDir: string,
  config: GlyphweaveConfig,
  post: DiscoveredTypstPost,
  typstVersion: string,
  preludeVersion: string | null,
  assets: GlyphweaveManifest['assets'],
  capture: GlyphweaveCaptureReport,
  diagnostics: GlyphweaveDiagnostic[],
  paths: { rawPath: string; contentPath: string; tocPath: string; pdfPath: string | null },
): GlyphweaveManifest {
  return {
    schemaVersion: 1,
    generator: 'glyphweave',
    generatorVersion: GLYPHWEAVE_VERSION,
    typstVersion,
    typst: {
      version: typstVersion,
      features: config.typst.htmlFeatures ? ['html'] : [],
      preludeVersion,
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

function assertHtmlDiagnostics(config: GlyphweaveConfig, diagnostics: GlyphweaveDiagnostic[]) {
  if (!config.math.failOnIgnoredEquation) return
  const ignoredEquation = diagnostics.find(
    (diagnostic) => diagnostic.code === 'typst-html-equation-ignored',
  )
  if (ignoredEquation) {
    throw new Error(`Typst HTML export ignored an equation: ${ignoredEquation.message}`)
  }
}

function assertCapture(config: GlyphweaveConfig, capture: GlyphweaveCaptureReport) {
  if (!config.capture.strict) return
  if (capture.math.failed === 0 && !capture.math.mismatch && capture.status !== 'failed') return
  throw new Error(
    `Strict capture failed: ${capture.math.failed} formula(s) missing, mismatch=${capture.math.mismatch}`,
  )
}

async function writeContentIndex(rootDir: string, config: GlyphweaveConfig, built: BuiltPost[]) {
  const posts: GlyphweaveContentIndex['posts'] = built.map(({ post, manifest }) => {
    const pdfPath = manifest.pdf.path
    return {
      id: post.metadata.slug,
      slug: post.metadata.slug,
      title: post.metadata.title,
      description: post.metadata.description,
      date: post.metadata.date,
      updated: post.metadata.updated,
      tags: post.metadata.tags,
      status: post.metadata.status,
      visibility: post.metadata.visibility,
      language: post.metadata.language ?? 'zh-CN',
      contentHtmlPath: manifest.html.contentPath,
      tocPath: manifest.html.tocPath,
      pdfPath,
      publicPdfPath: pdfPath
        ? `${config.output.publicBasePath.replace(/\/$/, '')}/posts/${post.metadata.slug}/article.pdf`
        : null,
      manifestPath: path.posix.join(
        config.output.root,
        'generated/posts',
        post.metadata.slug,
        'manifest.json',
      ),
    }
  })

  const index: GlyphweaveContentIndex = { schemaVersion: 1, posts }
  const outputPath = path.resolve(rootDir, config.output.root, 'content-index.json')
  await mkdir(path.dirname(outputPath), { recursive: true })
  await writeFile(outputPath, JSON.stringify(index, null, 2))
}

function relative(rootDir: string, target: string) {
  return path.relative(rootDir, target).replace(/\\/g, '/')
}
