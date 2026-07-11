import type { GlyphweaveConfig, GlyphweaveDiagnostic } from '@glyphweave/schema'

export interface TypstInfo {
  binary: string
  version: string
}

export interface CompileInput {
  binary: string
  inputPath: string
  outputPath: string
  cwd: string
  timeoutMs?: number
  logPath?: string
  rootPath?: string
  wrapper?: TypstWrapperOptions
}

export interface CompileOutput {
  outputPath: string
  stdout: string
  stderr: string
  diagnostics?: GlyphweaveDiagnostic[]
  preludeVersion?: string | null
}

export interface TypstHtmlWrapperOptions {
  mathStrategy?: GlyphweaveConfig['math']['strategy']
}

export interface TypstPdfWrapperOptions {
  injectTemplate?: boolean
  fonts?: string[]
  monoFonts?: string[]
  lang?: string
  region?: string
}

export interface TypstWrapperOptions extends TypstHtmlWrapperOptions {
  pdfTemplate?: TypstPdfWrapperOptions
}

export interface SourceFormula {
  id: string
  kind: 'inline' | 'block'
  source: string
  file: string
  startLine: number
  endLine: number
  startColumn?: number
  endColumn?: number
}

export interface TypstVersion {
  major: number
  minor: number
  patch: number
}
