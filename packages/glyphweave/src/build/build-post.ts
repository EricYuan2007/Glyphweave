import { mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { ManifestSchema } from '../schema/index.js'
import { adaptTypstHtml } from '../html/index.js'
import { assertCapture, createManifest, expectedPreludeVersion } from './manifest.js'
import type { BuildContext, DocumentPlan } from './context.js'

/** Compile and adapt one article inside an unpublished generation. */
export async function buildPost(context: BuildContext, plan: DocumentPlan) {
  const { rootDir, config, deps } = context
  const { post, outputDir, creationTimestamp } = plan
  const compileInput = {
    creationTimestamp,
    binary: config.typst.binary,
    inputPath: post.sourcePath,
    cwd: post.postDir,
    rootPath: post.postDir,
  }
  const outputRoot = path.resolve(rootDir, config.output.root)
  const logDir = path.join(outputRoot, 'logs')
  await mkdir(outputDir, { recursive: true })
  const rawPath = path.join(outputDir, 'raw.html')
  const contentPath = path.join(outputDir, 'content.html')
  const tocPath = path.join(outputDir, 'toc.json')
  const manifestPath = path.join(outputDir, 'manifest.json')

  const htmlCompile = await deps.compileHtml({
    ...compileInput,
    outputPath: rawPath,

    wrapper: {
      mathStrategy: config.math.strategy,
      nativeHtmlBinary: config.math.html.binary,
    },
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
      const pdfCompile = await deps.compilePdf({
        ...compileInput,
        outputPath: pdfPath,

        logPath: path.join(logDir, `${post.metadata.slug}.pdf.log`),
        wrapper: {
          pdfTemplate: config.typst.pdf.template,
        },
      })
      adapted.diagnostics.push(...(pdfCompile.diagnostics ?? []))
    } catch (error) {
      if (config.typst.pdf.failure === 'error') throw error
      adapted.diagnostics.push({
        code: 'glyphweave-pdf-failed',
        severity: 'warning',
        message: String(error),
      })
      await rm(pdfPath, { force: true })
      pdfPath = null
    }
  }

  const manifest = createManifest(context, {
    post,
    preludeVersion: htmlCompile.preludeVersion ?? expectedPreludeVersion(config),
    assets: adapted.rewrittenAssets,
    capture: adapted.capture,
    diagnostics: adapted.diagnostics,
    paths: { rawPath, contentPath, tocPath, pdfPath },
  })
  await writeFile(manifestPath, JSON.stringify(ManifestSchema.parse(manifest), null, 2))
  return manifest
}
