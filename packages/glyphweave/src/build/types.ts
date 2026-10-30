import type { CompileInput, CompileOutput, TypstInfo } from '../compiler/index.js'
import type { GlyphweaveManifest } from '../schema/index.js'
import type { DiscoveredTypstPost } from './discovery.js'

export interface BuildDependencies {
  /** Custom compilers must provide a stable identity to opt into caching. */
  cacheIdentity?: (binary: string) => Promise<string>
  typstInfo: (binary: string) => Promise<TypstInfo>
  compileHtml: (input: CompileInput) => Promise<CompileOutput>
  compilePdf: (input: CompileInput) => Promise<CompileOutput>
}

export interface BuildDocumentsResult {
  built: BuiltPost[]
  cache: { reused: number; compiled: number; enabled: boolean }
}

export interface BuildAllResult extends BuildDocumentsResult {
  skipped: DiscoveredTypstPost[]
}

export interface BuiltPost {
  post: DiscoveredTypstPost
  manifest: GlyphweaveManifest
}
