import type { CompileInput, CompileOutput, TypstInfo } from '@glyphweave/typst'
import type { GlyphweaveManifest } from '@glyphweave/schema'
import type { DiscoveredTypstPost } from './discovery.js'

export interface BuildDependencies {
  /** Custom compilers must provide a stable identity to opt into caching. */
  cacheIdentity?: (binary: string) => Promise<string>
  typstInfo: (binary: string) => Promise<TypstInfo>
  compileHtml: (input: CompileInput) => Promise<CompileOutput>
  compilePdf: (input: CompileInput) => Promise<CompileOutput>
}

export interface BuildAllResult {
  built: BuiltPost[]
  cache: { reused: number; compiled: number; enabled: boolean }
  skipped: DiscoveredTypstPost[]
}

export interface BuiltPost {
  post: DiscoveredTypstPost
  manifest: GlyphweaveManifest
}
