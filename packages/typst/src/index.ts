import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execa } from 'execa'
import type { GlyphweaveConfig, GlyphweaveDiagnostic } from '@glyphweave/schema'

export const GLYPHWEAVE_HTML_PRELUDE_VERSION = 'glyphweave-html-1'

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
  wrapper?: TypstHtmlWrapperOptions
}

export interface CompileOutput {
  outputPath: string
  stdout: string
  stderr: string
  diagnostics?: GlyphweaveDiagnostic[]
  preludeVersion?: string | null
}

export interface TypstHtmlWrapperOptions {
  injectPrelude?: boolean
  mathStrategy?: GlyphweaveConfig['math']['strategy']
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

export async function detectTypst(binary: string): Promise<TypstInfo> {
  const result = await execa(binary, ['--version'])
  return {
    binary,
    version: result.stdout.trim(),
  }
}

export async function compileTypstHtml(input: CompileInput): Promise<CompileOutput> {
  if (shouldUseHtmlWrapper(input.wrapper)) {
    return runTypstHtmlWrapper(input)
  }
  return runTypst(input, ['compile', '--features', 'html', '--format', 'html'])
}

export async function compileTypstPdf(input: CompileInput): Promise<CompileOutput> {
  return runTypst(input, ['compile'])
}

async function runTypst(input: CompileInput, args: string[]): Promise<CompileOutput> {
  return runTypstProcess(input, [...args, input.inputPath, input.outputPath], input.cwd, null)
}

async function runTypstProcess(
  input: CompileInput,
  args: string[],
  cwd: string,
  preludeVersion: string | null,
): Promise<CompileOutput> {
  await mkdir(path.dirname(input.outputPath), { recursive: true })
  const rootArgs = input.rootPath ? ['--root', input.rootPath] : []
  const result = await execa(input.binary, [...args.slice(0, 1), ...rootArgs, ...args.slice(1)], {
    cwd,
    timeout: input.timeoutMs ?? 30_000,
    reject: false,
  })
  const diagnostics = parseTypstDiagnostics([result.stdout, result.stderr].filter(Boolean).join('\n'))

  if (input.logPath) {
    await mkdir(path.dirname(input.logPath), { recursive: true })
    await writeFile(input.logPath, [result.stdout, result.stderr].filter(Boolean).join('\n'))
  }

  if (result.exitCode !== 0) {
    const reason = result.stderr || result.stdout || `Typst exited with code ${result.exitCode}`
    throw new Error(reason)
  }

  return {
    outputPath: input.outputPath,
    stdout: result.stdout,
    stderr: result.stderr,
    diagnostics,
    preludeVersion,
  }
}

async function runTypstHtmlWrapper(input: CompileInput): Promise<CompileOutput> {
  const workspace = await mkdtemp(path.join(os.tmpdir(), 'glyphweave-typst-html-'))
  try {
    const sourceDir = path.join(workspace, 'source')
    await cp(input.cwd, sourceDir, { recursive: true, verbatimSymlinks: true })

    const wrapperDir = path.join(sourceDir, '__glyphweave__')
    await mkdir(wrapperDir, { recursive: true })

    const preludeSourcePath = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      '../prelude/glyphweave-html.typ',
    )
    const prelude = await readFile(preludeSourcePath, 'utf-8')
    await writeFile(path.join(wrapperDir, 'glyphweave-html.typ'), prelude)

    const relativeSource = path.relative(input.cwd, input.inputPath).replace(/\\/g, '/')
    const includePath = `../${relativeSource}`
    const wrapperPath = path.join(wrapperDir, 'main.html.typ')
    await writeFile(
      wrapperPath,
      [
        '#import "glyphweave-html.typ": glyphweave-html',
        '#show: glyphweave-html',
        `#include ${JSON.stringify(includePath)}`,
        '',
      ].join('\n'),
    )

    return await runTypstProcess(
      { ...input, rootPath: sourceDir },
      ['compile', '--features', 'html', '--format', 'html', wrapperPath, input.outputPath],
      sourceDir,
      GLYPHWEAVE_HTML_PRELUDE_VERSION,
    )
  } finally {
    await rm(workspace, { recursive: true, force: true })
  }
}

function shouldUseHtmlWrapper(wrapper: TypstHtmlWrapperOptions | undefined) {
  if (wrapper?.injectPrelude === false) return false
  if (wrapper?.mathStrategy === 'disabled' || wrapper?.mathStrategy === 'native-only') return false
  return true
}

export async function scanSourceFormulas(sourcePath: string): Promise<SourceFormula[]> {
  const source = await readFile(sourcePath, 'utf-8')
  return scanSourceFormulasFromText(source, sourcePath)
}

export function scanSourceFormulasFromText(source: string, file = ''): SourceFormula[] {
  const formulas: SourceFormula[] = []
  const lines = source.replace(/\r\n/g, '\n').split('\n')
  let inRawFence = false
  let id = 1

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex]!
    if (line.trimStart().startsWith('```')) {
      inRawFence = !inRawFence
      continue
    }
    if (inRawFence) continue

    let columnIndex = 0
    while (columnIndex < line.length) {
      if (line[columnIndex] === '`' && !isEscaped(line, columnIndex)) {
        const rawClose = findUnescapedBacktick(line, columnIndex + 1)
        columnIndex = rawClose === -1 ? line.length : rawClose + 1
        continue
      }

      if (line[columnIndex] !== '$' || isEscaped(line, columnIndex)) {
        columnIndex += 1
        continue
      }

      const sameLineClose = findUnescapedDollar(line, columnIndex + 1)
      if (sameLineClose !== -1) {
        const before = line.slice(0, columnIndex)
        const after = line.slice(sameLineClose + 1)
        formulas.push({
          id: `math-${id++}`,
          kind: before.trim() === '' && after.trim() === '' ? 'block' : 'inline',
          source: line.slice(columnIndex + 1, sameLineClose).trim(),
          file,
          startLine: lineIndex + 1,
          endLine: lineIndex + 1,
          startColumn: columnIndex + 1,
          endColumn: sameLineClose + 1,
        })
        columnIndex = sameLineClose + 1
        continue
      }

      const block = findMultilineFormula(lines, lineIndex, columnIndex)
      if (block) {
        formulas.push({
          id: `math-${id++}`,
          kind: 'block',
          source: block.source.trim(),
          file,
          startLine: lineIndex + 1,
          endLine: block.endLine + 1,
          startColumn: columnIndex + 1,
          endColumn: block.endColumn + 1,
        })
        lineIndex = block.endLine
        break
      }

      columnIndex += 1
    }
  }

  return formulas
}

function findMultilineFormula(
  lines: string[],
  startLine: number,
  startColumn: number,
): { source: string; endLine: number; endColumn: number } | null {
  const chunks = [lines[startLine]!.slice(startColumn + 1)]
  for (let lineIndex = startLine + 1; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex]!
    const closeColumn = findUnescapedDollar(line, 0)
    if (closeColumn !== -1) {
      chunks.push(line.slice(0, closeColumn))
      return {
        source: chunks.join('\n'),
        endLine: lineIndex,
        endColumn: closeColumn,
      }
    }
    chunks.push(line)
  }
  return null
}

function findUnescapedDollar(line: string, start: number) {
  for (let index = start; index < line.length; index += 1) {
    if (line[index] === '$' && !isEscaped(line, index)) return index
  }
  return -1
}

function findUnescapedBacktick(line: string, start: number) {
  for (let index = start; index < line.length; index += 1) {
    if (line[index] === '`' && !isEscaped(line, index)) return index
  }
  return -1
}

function isEscaped(line: string, index: number) {
  let slashes = 0
  for (let cursor = index - 1; cursor >= 0 && line[cursor] === '\\'; cursor -= 1) {
    slashes += 1
  }
  return slashes % 2 === 1
}

export function parseTypstDiagnostics(output: string): GlyphweaveDiagnostic[] {
  const diagnostics: GlyphweaveDiagnostic[] = []
  for (const rawLine of output.split(/\r?\n/)) {
    const line = rawLine.trim()
    const warning = line.match(/^warning:\s*(.+)$/i)
    const message = warning?.[1]?.trim()
    if (!message) continue

    if (message === 'equation was ignored during HTML export') {
      diagnostics.push({
        code: 'typst-html-equation-ignored',
        severity: 'warning',
        message,
      })
      continue
    }

    if (/^.+ was ignored during HTML export$/.test(message)) {
      diagnostics.push({
        code: 'typst-html-content-ignored',
        severity: 'warning',
        message,
      })
      continue
    }

    if (/HTML export is experimental/i.test(message) || /html export is under active development/i.test(message)) {
      diagnostics.push({
        code: 'typst-html-experimental',
        severity: 'info',
        message,
      })
    }
  }
  return diagnostics
}
