import { prepareNativeEngine } from './native-engine.js'
import { createCompilerIdentity } from '../compiler/index.js'
import {
  hash,
  implementationIdentity,
  snapshotTree,
  nativeRendererIdentity,
} from './fingerprint.js'
import { readCache, reusePost, type BuildCache } from './cache.js'
import { randomUUID } from 'node:crypto'
import { ContentIndexSchema } from '../schema/index.js'
import { lockOutput, ownOutput, OWNER_FILE, validateOutputRoot } from './output.js'
import { mkdir, rm, writeFile, readFile, rename, realpath } from 'node:fs/promises'
import path from 'node:path'
import { defaultConfig, type GlyphweaveConfig } from '../schema/index.js'
import {
  assertSupportedTypst,
  compileTypstHtml,
  compileTypstPdf,
  detectTypst,
} from '../compiler/index.js'
import { writeContentIndex } from './content-index.js'
import type { DiscoveredTypstPost } from './discovery.js'
import { buildPost } from './build-post.js'
import type { BuildDependencies, BuildDocumentsResult, BuiltPost } from './types.js'
export type { BuildDependencies, BuildDocumentsResult, BuildAllResult, BuiltPost } from './types.js'

const defaultBuildDependencies: BuildDependencies = {
  typstInfo: detectTypst,
  compileHtml: compileTypstHtml,
  compilePdf: compileTypstPdf,
}

async function buildGeneration(
  rootDir: string,
  config = defaultConfig(),
  deps: BuildDependencies,
  output: string,
  stableConfig: GlyphweaveConfig,
  loadDocuments: () => Promise<DiscoveredTypstPost[]>,
): Promise<BuildDocumentsResult> {
  await mkdir(path.resolve(rootDir, config.output.root), { recursive: true })
  const posts = structuredClone(await loadDocuments())
  const slugs = new Set<string>()
  for (const post of posts) {
    const slug = post.metadata.slug
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slugs.has(slug))
      throw new Error(`Invalid or duplicate document slug: ${slug}`)
    slugs.add(slug)
  }
  const outputRoot = path.resolve(rootDir, config.output.root)
  const typst = await deps.typstInfo(config.typst.binary)
  assertSupportedTypst(typst.version)
  const identify = deps === defaultBuildDependencies ? createCompilerIdentity() : deps.cacheIdentity
  const enabled = stableConfig.cache.enabled && Boolean(identify)
  const environment = identify ? await identify(config.typst.binary) : ''
  // Native HTML layout and semantics come from one embedded compiler. The CLI
  // builds PDF independently; requiring its exact patch version adds no safety.
  const hasDocuments = posts.length > 0
  if (config.math.strategy === 'html-frame' && hasDocuments)
    config.math.html.binary = await prepareNativeEngine(config.math.html.binary, rootDir)
  const nativeEnvironment =
    config.math.strategy === 'html-frame' && hasDocuments
      ? await nativeRendererIdentity(config.math.html.binary, rootDir)
      : ''
  const implementation = identify ? await implementationIdentity(rootDir) : ''
  const previous = enabled ? await readCache(rootDir, output) : { version: 1 as const, entries: {} }
  const next: BuildCache = { version: 1, entries: {} }
  const cache = { reused: 0, compiled: 0, enabled }
  const snapshots = new Map<string, string>()
  const built: BuiltPost[] = []

  for (const post of posts) {
    const outputDir = path.resolve(
      rootDir,
      config.output.root,
      'generated/posts',
      post.metadata.slug,
    )
    const snapshot = hash(JSON.stringify(await snapshotTree(post.postDir)))
    snapshots.set(post.postDir, snapshot)
    const epoch = process.env.SOURCE_DATE_EPOCH
    const creationTimestamp =
      epoch === undefined
        ? Math.floor(Date.parse(post.metadata.updated ?? post.metadata.date) / 1000)
        : Number(epoch)
    if (!Number.isSafeInteger(creationTimestamp) || creationTimestamp < 0)
      throw new Error('Invalid build creation timestamp')
    const key = hash(
      JSON.stringify({
        snapshot,
        source: post.sourcePath,
        config: { ...stableConfig, cache: undefined },
        environment,
        nativeEnvironment,
        implementation,
        typst: typst.version,
        creationTimestamp,
      }),
    )
    const reused = enabled
      ? await reusePost(rootDir, output, outputDir, previous.entries[post.metadata.slug], key)
      : undefined
    if (reused) {
      cache.reused++
      built.push({ post, manifest: reused })
      next.entries[post.metadata.slug] = {
        key,
        directory: path.relative(rootDir, outputDir),
        files: await snapshotTree(outputDir),
      }
      continue
    }
    cache.compiled++
    const manifest = await buildPost(
      rootDir,
      config,
      deps,
      post,
      outputDir,
      typst.version,
      creationTimestamp,
    )
    built.push({ post, manifest })
    if (
      identify &&
      !manifest.diagnostics.some((diagnostic) => diagnostic.code === 'glyphweave-pdf-failed')
    ) {
      next.entries[post.metadata.slug] = {
        key,
        directory: path.relative(rootDir, outputDir),
        files: await snapshotTree(outputDir),
      }
    }
  }

  // Validate inputs again before committing the generation, including changes made during reuse.
  const rediscovered = await loadDocuments()
  if (JSON.stringify(rediscovered) !== JSON.stringify(posts))
    throw new Error('Posts changed during build; retry')
  for (const [directory, snapshot] of snapshots) {
    if (hash(JSON.stringify(await snapshotTree(directory))) !== snapshot)
      throw new Error('Article inputs changed during build; retry')
  }
  if (
    config.math.strategy === 'html-frame' &&
    hasDocuments &&
    (await nativeRendererIdentity(config.math.html.binary, rootDir)) !== nativeEnvironment
  )
    throw new Error('Native renderer changed during build; retry')
  // Never publish a generation assembled from different compiler/font/package environments.
  if (identify && (await identify(config.typst.binary)) !== environment)
    throw new Error(
      'Compiler environment changed during build (possibly a first package download); retry',
    )
  if (identify && (await implementationIdentity(rootDir)) !== implementation)
    throw new Error('Generator implementation changed during build; retry')
  await writeFile(path.join(outputRoot, 'cache.json'), JSON.stringify(next, null, 2))
  await writeContentIndex(
    rootDir,
    config,
    built,
    path.relative(rootDir, path.join(outputRoot, 'cache.json')),
  )
  return { built, cache }
}

/** Build an immutable generation and atomically replace the index only after complete success.
 * Consumers must resolve paths from one index snapshot; old generations stay valid until clean.
 */
export async function buildDocuments(
  rootDir: string,
  config = defaultConfig(),
  loadDocuments: () => Promise<DiscoveredTypstPost[]>,
  deps: BuildDependencies = defaultBuildDependencies,
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
    const generationConfig = {
      ...config,
      output: { ...config.output, root: path.relative(rootDir, generation) },
    }
    const result = await buildGeneration(
      rootDir,
      generationConfig,
      deps,
      output,
      config,
      loadDocuments,
    )
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
