import { createCompilerIdentity } from '@glyphweave/typst'
import { hash, implementationIdentity, snapshotTree } from './fingerprint.js'
import { readCache, reusePost, type BuildCache } from './cache.js'
import { randomUUID } from 'node:crypto'
import { ContentIndexSchema } from '@glyphweave/schema'
import { lockOutput, ownOutput, OWNER_FILE, validateOutputRoot } from './output.js'
import { mkdir, rm, writeFile, readFile, rename, realpath } from 'node:fs/promises'
import path from 'node:path'
import { defaultConfig, type GlyphweaveConfig } from '@glyphweave/schema'
import {
  assertSupportedTypst,
  compileTypstHtml,
  compileTypstPdf,
  detectTypst,
} from '@glyphweave/typst'
import { writeContentIndex } from './content-index.js'
import { discoverPosts, type DiscoveredTypstPost } from './discovery.js'
import { buildPost } from './build-post.js'
import type { BuildDependencies, BuildAllResult, BuiltPost } from './types.js'
export type { BuildDependencies, BuildAllResult, BuiltPost } from './types.js'

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
): Promise<BuildAllResult> {
  await mkdir(path.resolve(rootDir, config.output.root), { recursive: true })
  const posts = await discoverPosts(rootDir, config)
  const outputRoot = path.resolve(rootDir, config.output.root)
  const typst = await deps.typstInfo(config.typst.binary)
  assertSupportedTypst(typst.version)
  const identify = deps === defaultBuildDependencies ? createCompilerIdentity() : deps.cacheIdentity
  const enabled = stableConfig.cache.enabled && Boolean(identify)
  const environment = identify ? await identify(config.typst.binary) : ''
  const implementation = enabled ? await implementationIdentity(rootDir) : ''
  const previous = enabled ? await readCache(rootDir, output) : { version: 1 as const, entries: {} }
  const next: BuildCache = { version: 1, entries: {} }
  const cache = { reused: 0, compiled: 0, enabled }
  const snapshots = new Map<string, string>()
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
      enabled &&
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
  const rediscovered = await discoverPosts(rootDir, stableConfig)
  if (JSON.stringify(rediscovered) !== JSON.stringify(posts))
    throw new Error('Posts changed during build; retry')
  for (const [directory, snapshot] of snapshots) {
    if (hash(JSON.stringify(await snapshotTree(directory))) !== snapshot)
      throw new Error('Article inputs changed during build; retry')
  }
  // Never publish a generation assembled from different compiler/font/package environments.
  if (identify && (await identify(config.typst.binary)) !== environment)
    throw new Error(
      'Compiler environment changed during build (possibly a first package download); retry',
    )
  if (enabled && (await implementationIdentity(rootDir)) !== implementation)
    throw new Error('Generator implementation changed during build; retry')
  await writeFile(path.join(outputRoot, 'cache.json'), JSON.stringify(next, null, 2))
  await writeContentIndex(
    rootDir,
    config,
    built,
    path.relative(rootDir, path.join(outputRoot, 'cache.json')),
  )
  return { built, skipped, cache }
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
    const result = await buildGeneration(rootDir, generationConfig, deps, output, config)
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
