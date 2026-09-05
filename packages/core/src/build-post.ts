import { mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { ManifestSchema, type GlyphweaveConfig } from '@glyphweave/schema'
import { adaptTypstHtml } from '@glyphweave/html-adapter'
import {
  assertCapture,
  createManifest,
  expectedPdfPreludeVersion,
  expectedPreludeVersion,
} from './manifest.js'
import type { BuildDependencies } from './types.js'
import type { DiscoveredTypstPost } from './discovery.js'

/** Compile and adapt one article inside an unpublished generation. */
export async function buildPost(
  rootDir: string,
  config: GlyphweaveConfig,
  deps: BuildDependencies,
  post: DiscoveredTypstPost,
  outputDir: string,
  typstVersion: string,
  creationTimestamp: number,
) {
  const outputRoot = path.resolve(rootDir, config.output.root)
  const logDir = path.join(outputRoot, 'logs')
  await mkdir(outputDir, { recursive: true })
  const rawPath = path.join(outputDir, 'raw.html')
  const contentPath = path.join(outputDir, 'content.html')
  const tocPath = path.join(outputDir, 'toc.json')
  const manifestPath = path.join(outputDir, 'manifest.json')

  const htmlCompile = await deps.compileHtml({
    creationTimestamp,
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
    assets: config.assets,
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
        creationTimestamp,
        binary: config.typst.binary,
        inputPath: post.sourcePath,
        outputPath: pdfPath,
        cwd: post.postDir,
        rootPath: post.postDir,
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
      adapted.diagnostics.push({
        code: 'glyphweave-pdf-failed',
        severity: 'warning',
        message: String(error),
      })
      await rm(pdfPath!, { force: true })
      pdfPath = null
    }
  }

  const manifest = createManifest(
    rootDir,
    config,
    post,
    typstVersion,
    htmlCompile.preludeVersion ?? expectedPreludeVersion(config),
    expectedPdfPreludeVersion(config),
    adapted.rewrittenAssets,
    adapted.capture,
    adapted.diagnostics,
    { rawPath, contentPath, tocPath, pdfPath },
  )
  await writeFile(manifestPath, JSON.stringify(ManifestSchema.parse(manifest), null, 2))
  return manifest
}
