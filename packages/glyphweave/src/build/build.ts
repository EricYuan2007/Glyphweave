import { openGlyphweaveSnapshot } from '../artifacts/index.js'
import { createCompilerIdentity } from '../compiler/index.js'
import { snapshotTree } from './fingerprint.js'
import {
  prepareBuildContext,
  planDocument,
  validateBuildInputs,
  type BuildContext,
} from './context.js'
import { readCache, reusePost, type BuildCache } from './cache.js'
import { randomUUID } from 'node:crypto'
import { ContentIndexSchema } from '../schema/index.js'
import { lockOutput, ownOutput, OWNER_FILE, validateOutputRoot } from './output.js'
import { mkdir, rm, writeFile, readFile, rename, realpath } from 'node:fs/promises'
import path from 'node:path'
import { defaultConfig, type GlyphweaveConfig } from '../schema/index.js'
import { compileTypstHtml, compileTypstPdf, detectTypst, verifyPdf } from '../compiler/index.js'
import { writeContentIndex } from './content-index.js'
import type { DocumentInput } from './document.js'
import { buildPost } from './build-post.js'
import type { BuildDependencies, BuildDocumentsResult, BuiltPost } from './types.js'
export type { BuildDependencies, BuildDocumentsResult, BuildAllResult, BuiltPost } from './types.js'

function defaultBuildDependencies(): BuildDependencies {
  return {
    typstInfo: detectTypst,
    verifyPdf,
    compileHtml: compileTypstHtml,
    compilePdf: compileTypstPdf,
    cacheIdentity: createCompilerIdentity(),
  }
}

async function buildGeneration(
  context: BuildContext,
  output: string,
  loadDocuments: () => Promise<DocumentInput[]>,
): Promise<Omit<BuildDocumentsResult, 'snapshot'>> {
  const { rootDir, config, enabled } = context
  const outputRoot = path.resolve(rootDir, config.output.root)
  await mkdir(outputRoot, { recursive: true })
  const plans = []
  for (const post of context.posts) plans.push(await planDocument(context, post))
  const previous = enabled ? await readCache(rootDir, output) : { version: 1 as const, entries: {} }
  const next: BuildCache = { version: 1, entries: {} }
  const cache = { reused: 0, compiled: 0, enabled }
  const built: BuiltPost[] = []
  for (const plan of plans) {
    const { post, outputDir, key } = plan
    const reused = enabled
      ? await reusePost(rootDir, output, outputDir, previous.entries[post.id], key)
      : undefined
    const manifest = reused ?? (await buildPost(context, plan))
    if (reused) cache.reused++
    else cache.compiled++
    built.push({ post, manifest })
    if (context.identify && !manifest.diagnostics.some((d) => d.code === 'glyphweave-pdf-failed')) {
      next.entries[post.id] = {
        key,
        directory: path.relative(rootDir, outputDir),
        files: await snapshotTree(outputDir),
      }
    }
  }
  await validateBuildInputs(context, plans, loadDocuments)
  await writeFile(path.join(outputRoot, 'cache.json'), JSON.stringify(next, null, 2))
  await writeContentIndex(
    rootDir,
    config,
    built,
    path.relative(rootDir, path.join(outputRoot, 'cache.json')),
    path.relative(rootDir, output),
  )
  return { built, cache, typstVersion: context.typstVersion }
}

/** Build an immutable generation and atomically replace the index only after complete success.
 * Consumers must resolve paths from one index snapshot; old generations stay valid until clean.
 */
export async function buildDocuments(
  rootDir: string,
  config = defaultConfig(),
  loadDocuments: () => Promise<DocumentInput[]>,
  deps: BuildDependencies = defaultBuildDependencies(),
): Promise<BuildDocumentsResult> {
  rootDir = await realpath(rootDir)
  config = structuredClone(config)
  if (config.typst.binary.includes('/') || config.typst.binary.includes('\\'))
    config.typst.binary = path.resolve(rootDir, config.typst.binary)
  const output = await ownOutput(rootDir, config)
  const unlock = await lockOutput(output)
  const generation = path.join(output, 'generations', randomUUID())
  const temporaryIndex = path.join(output, `.index-${randomUUID()}.json`)
  let committed = false
  try {
    const context = await prepareBuildContext(rootDir, config, generation, deps, loadDocuments)
    const result = await buildGeneration(context, output, loadDocuments)
    const index = ContentIndexSchema.parse(
      JSON.parse(await readFile(path.join(generation, 'content-index.json'), 'utf8')),
    )
    const snapshot = await openGlyphweaveSnapshot(
      rootDir,
      path.join(generation, 'content-index.json'),
    )
    await writeFile(temporaryIndex, JSON.stringify(index, null, 2), { flag: 'wx' })
    await rename(temporaryIndex, path.join(output, 'content-index.json'))
    committed = true
    return { ...result, snapshot }
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
  const post = index.posts.find((post) => post.id === slug)
  if (!post) throw new Error(`Post not found in current generation: ${slug}`)
  return path.dirname(path.resolve(rootDir, post.manifestPath))
}
