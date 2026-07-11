import { mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { adaptTypstHtml } from '@glyphweave/html-adapter'
import { defaultConfig, type GlyphweaveConfig, type GlyphweaveManifest } from '@glyphweave/schema'
import {
  assertSupportedTypst,
  compileTypstHtml,
  compileTypstPdf,
  detectTypst,
  type CompileInput,
  type CompileOutput,
  type TypstInfo,
} from '@glyphweave/typst'
import { writeContentIndex } from './content-index.js'
import { discoverPosts, type DiscoveredTypstPost } from './discovery.js'
import {
  assertCapture,
  createManifest,
  expectedPdfPreludeVersion,
  expectedPreludeVersion,
} from './manifest.js'

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

export async function buildAll(
  rootDir: string,
  config = defaultConfig(),
  deps: BuildDependencies = defaultBuildDependencies,
): Promise<BuildAllResult> {
  const posts = await discoverPosts(rootDir, config)
  const outputRoot = path.resolve(rootDir, config.output.root)
  const typst = await deps.typstInfo(config.typst.binary)
  assertSupportedTypst(typst.version)
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
      wrapper: { mathStrategy: config.math.strategy },
      logPath: path.join(logDir, `${post.metadata.slug}.html.log`),
    })
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
          wrapper: {
            pdfTemplate: {
              injectTemplate: config.typst.pdf.template.enabled,
              fonts: config.typst.pdf.template.fonts,
              monoFonts: config.typst.pdf.template.monoFonts,
              lang: config.typst.pdf.template.lang,
              region: config.typst.pdf.template.region,
            },
          },
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
      expectedPdfPreludeVersion(config),
      adapted.rewrittenAssets,
      adapted.capture,
      adapted.diagnostics,
      { rawPath, contentPath, tocPath, pdfPath },
    )
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2))
    built.push({ post, manifest })
  }

  await writeContentIndex(rootDir, config, built)
  return { built, skipped }
}

export async function clean(rootDir: string, config = defaultConfig()) {
  await rm(path.resolve(rootDir, config.output.root), { recursive: true, force: true })
}

export function resolvePostOutputDir(rootDir: string, config: GlyphweaveConfig, slug: string) {
  return path.resolve(rootDir, config.output.root, 'generated/posts', slug)
}
