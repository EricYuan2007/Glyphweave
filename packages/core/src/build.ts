import { randomUUID } from 'node:crypto'
import { ContentIndexSchema, ManifestSchema } from '@glyphweave/schema'
import { lockOutput, ownOutput, OWNER_FILE, validateOutputRoot } from './output.js'
import { mkdir, rm, writeFile, readFile, rename, realpath } from 'node:fs/promises'
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

async function buildGeneration(
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
    if (post.metadata.visibility === 'private' || post.metadata.status !== 'published') {
      skipped.push(post)
      continue
    }
    const outputDir = path.resolve(
      rootDir,
      config.output.root,
      'generated/posts',
      post.metadata.slug,
    )
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
      typst.version,
      htmlCompile.preludeVersion ?? expectedPreludeVersion(config),
      expectedPdfPreludeVersion(config),
      adapted.rewrittenAssets,
      adapted.capture,
      adapted.diagnostics,
      { rawPath, contentPath, tocPath, pdfPath },
    )
    await writeFile(manifestPath, JSON.stringify(ManifestSchema.parse(manifest), null, 2))
    built.push({ post, manifest })
  }

  await writeContentIndex(rootDir, config, built)
  return { built, skipped }
}

/** Build an immutable generation and atomically replace the index only after complete success.
 * Consumers must resolve paths from one index snapshot; old generations stay valid until clean.
 */
export async function buildAll(
  rootDir: string,
  config = defaultConfig(),
  deps: BuildDependencies = defaultBuildDependencies,
): Promise<BuildAllResult> {
  rootDir = await realpath(rootDir)
  const output = await ownOutput(rootDir, config)
  const unlock = await lockOutput(output)
  const generation = path.join(output, 'generations', randomUUID())
  const temporaryIndex = path.join(output, `.index-${randomUUID()}.json`)
  let committed = false
  try {
    const generationConfig = {
      ...config,
      output: { ...config.output, root: path.relative(rootDir, generation) },
    }
    const result = await buildGeneration(rootDir, generationConfig, deps)
    const index = ContentIndexSchema.parse(
      JSON.parse(await readFile(path.join(generation, 'content-index.json'), 'utf8')),
    )
    await writeFile(temporaryIndex, JSON.stringify(index, null, 2), { flag: 'wx' })
    await rename(temporaryIndex, path.join(output, 'content-index.json'))
    committed = true
    return result
  } catch (error) {
    throw new Error(
      `Build failed; previous index preserved: ${error instanceof Error ? error.message : error}`,
      { cause: error },
    )
  } finally {
    await rm(temporaryIndex, { force: true })
    if (!committed) await rm(generation, { recursive: true, force: true })
    await unlock()
  }
}

/** Delete only an owned, validated output directory; never adopt an unmarked directory. */
export async function clean(rootDir: string, config = defaultConfig()) {
  const output = await validateOutputRoot(rootDir, config)
  const marker = JSON.parse(await readFile(path.join(output, OWNER_FILE), 'utf8'))
  if (marker.generator !== 'glyphweave' || marker.root !== (await realpath(rootDir)))
    throw new Error('Output ownership mismatch')
  const unlock = await lockOutput(output)
  try {
    await rm(output, { recursive: true, force: true })
  } finally {
    await unlock()
  }
}

/** Resolve a post through the committed index, not by guessing generation paths. */
export async function resolvePostOutputDir(
  rootDir: string,
  config: GlyphweaveConfig,
  slug: string,
) {
  const index = ContentIndexSchema.parse(
    JSON.parse(
      await readFile(path.resolve(rootDir, config.output.root, 'content-index.json'), 'utf8'),
    ),
  )
  const post = index.posts.find((post) => post.slug === slug)
  if (!post) throw new Error(`Post not found in current generation: ${slug}`)
  return path.dirname(path.resolve(rootDir, post.manifestPath))
}
