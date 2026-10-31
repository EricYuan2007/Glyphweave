import path from 'node:path'
import { assertSupportedTypst } from '../compiler/index.js'
import type { GlyphweaveConfig } from '../schema/index.js'
import type { BuildDependencies } from './types.js'
import type { DiscoveredTypstPost } from './discovery.js'
import { prepareNativeEngine } from './native-engine.js'
import {
  hash,
  implementationIdentity,
  nativeRendererIdentity,
  snapshotTree,
} from './fingerprint.js'

function freezeConfig<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freezeConfig(child)
    Object.freeze(value)
  }
  return value
}

export async function prepareBuildContext(
  rootDir: string,
  config: GlyphweaveConfig,
  generation: string,
  deps: BuildDependencies,
  loadDocuments: () => Promise<DiscoveredTypstPost[]>,
) {
  const posts = structuredClone(await loadDocuments())
  const slugs = new Set<string>()
  for (const post of posts) {
    const slug = post.metadata.slug
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slugs.has(slug))
      throw new Error(`Invalid or duplicate document slug: ${slug}`)
    slugs.add(slug)
  }
  const typst = await deps.typstInfo(config.typst.binary)
  assertSupportedTypst(typst.version)
  const identify = deps.cacheIdentity
  const enabled = config.cache.enabled && Boolean(identify)
  const environment = identify ? await identify(config.typst.binary) : ''
  // Native HTML layout and semantics come from one embedded compiler. The CLI
  // builds PDF independently; requiring its exact patch version adds no safety.
  const hasDocuments = posts.length > 0
  const nativeBinary =
    config.math.strategy === 'html-frame' && hasDocuments
      ? await prepareNativeEngine(config.math.html.binary, rootDir)
      : config.math.html.binary
  const resolvedConfig = freezeConfig({
    ...config,
    output: { ...config.output, root: path.relative(rootDir, generation) },
    math: { ...config.math, html: { binary: nativeBinary } },
  })
  const nativeEnvironment =
    config.math.strategy === 'html-frame' && hasDocuments
      ? await nativeRendererIdentity(nativeBinary)
      : ''
  const implementation = identify ? await implementationIdentity(rootDir) : ''
  return Object.freeze({
    rootDir,
    config: resolvedConfig,
    stableConfig: freezeConfig(config),
    deps,
    posts,
    epoch: process.env.SOURCE_DATE_EPOCH,
    typstVersion: typst.version,
    enabled,
    identify,
    environment,
    nativeEnvironment,
    implementation,
  })
}
export type BuildContext = Awaited<ReturnType<typeof prepareBuildContext>>

export async function planDocument(context: BuildContext, post: DiscoveredTypstPost) {
  const { rootDir } = context
  const outputDir = path.resolve(
    rootDir,
    context.config.output.root,
    'generated/posts',
    post.metadata.slug,
  )
  const snapshot = hash(JSON.stringify(await snapshotTree(post.postDir)))
  const epoch = context.epoch
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
      config: { ...context.stableConfig, cache: undefined },
      environment: context.environment,
      nativeEnvironment: context.nativeEnvironment,
      implementation: context.implementation,
      typst: context.typstVersion,
      creationTimestamp,
    }),
  )
  return Object.freeze({ post, outputDir, snapshot, creationTimestamp, key })
}
export type DocumentPlan = Awaited<ReturnType<typeof planDocument>>

export async function validateBuildInputs(
  context: BuildContext,
  plans: DocumentPlan[],
  loadDocuments: () => Promise<DiscoveredTypstPost[]>,
) {
  const { rootDir, config, identify } = context
  // Validate inputs again before committing the generation, including changes made during reuse.
  const rediscovered = await loadDocuments()
  if (JSON.stringify(rediscovered) !== JSON.stringify(context.posts))
    throw new Error('Posts changed during build; retry')
  for (const { post, snapshot } of plans) {
    if (hash(JSON.stringify(await snapshotTree(post.postDir))) !== snapshot)
      throw new Error('Article inputs changed during build; retry')
  }
  if (
    context.nativeEnvironment &&
    (await nativeRendererIdentity(config.math.html.binary)) !== context.nativeEnvironment
  )
    throw new Error('Native renderer changed during build; retry')
  // Never publish a generation assembled from different compiler/font/package environments.
  if (identify && (await identify(config.typst.binary)) !== context.environment)
    throw new Error(
      'Compiler environment changed during build (possibly a first package download); retry',
    )
  if (identify && (await implementationIdentity(rootDir)) !== context.implementation)
    throw new Error('Generator implementation changed during build; retry')
}
