import path from 'node:path'
import { createHash } from 'node:crypto'
import { detectTypst, createCompilerIdentity } from '../compiler/index.js'
import { prepareNativeEngine } from './native-engine.js'
import { nativeRendererIdentity, implementationIdentity } from './fingerprint.js'
import type { GlyphweaveConfig } from '../schema/index.js'

/** The host can validate whole-site reuse without knowing compiler internals. */
export async function compilerEnvironment(
  root: string,
  config: GlyphweaveConfig,
  hasDocuments: boolean,
) {
  if (!hasDocuments) return { version: 'unused', identity: 'empty' }
  const binary = /[/\\]/.test(config.typst.binary)
    ? path.resolve(root, config.typst.binary)
    : config.typst.binary
  const typst = await detectTypst(binary)
  const identity = createHash('sha256')
    .update(await createCompilerIdentity()(binary))
    .update(await implementationIdentity(root))
  if (config.math.strategy === 'html-frame')
    identity.update(
      await nativeRendererIdentity(await prepareNativeEngine(config.math.html.binary, root)),
    )
  return { version: typst.version, identity: identity.digest('hex') }
}
