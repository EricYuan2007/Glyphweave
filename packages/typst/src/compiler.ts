import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execa } from 'execa'
import { parseTypstDiagnostics } from './diagnostics.js'
import type {
  CompileInput,
  CompileOutput,
  TypstHtmlWrapperOptions,
  TypstPdfWrapperOptions,
} from './types.js'

export const GLYPHWEAVE_HTML_PRELUDE_VERSION = 'glyphweave-html-2'
export const GLYPHWEAVE_PDF_PRELUDE_VERSION = 'glyphweave-pdf-1'

export async function compileTypstHtml(input: CompileInput): Promise<CompileOutput> {
  if (shouldUseHtmlWrapper(input.wrapper)) {
    return runTypstHtmlWrapper(input)
  }
  return runTypst(input, ['compile', '--features', 'html', '--format', 'html'])
}

export async function compileTypstPdf(input: CompileInput): Promise<CompileOutput> {
  if (shouldUsePdfWrapper(input.wrapper?.pdfTemplate)) {
    return runTypstPdfWrapper(input)
  }
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

async function runTypstPdfWrapper(input: CompileInput): Promise<CompileOutput> {
  const workspace = await mkdtemp(path.join(os.tmpdir(), 'glyphweave-typst-pdf-'))
  try {
    const sourceDir = path.join(workspace, 'source')
    await cp(input.cwd, sourceDir, { recursive: true, verbatimSymlinks: true })

    const wrapperDir = path.join(sourceDir, '__glyphweave__')
    await mkdir(wrapperDir, { recursive: true })

    const preludeSourcePath = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      '../prelude/glyphweave-pdf.typ',
    )
    const prelude = await readFile(preludeSourcePath, 'utf-8')
    await writeFile(path.join(wrapperDir, 'glyphweave-pdf.typ'), prelude)

    const template = input.wrapper?.pdfTemplate
    const relativeSource = path.relative(input.cwd, input.inputPath).replace(/\\/g, '/')
    const includePath = `../${relativeSource}`
    const wrapperPath = path.join(wrapperDir, 'main.pdf.typ')
    await writeFile(
      wrapperPath,
      [
        '#import "glyphweave-pdf.typ": glyphweave-pdf',
        `#show: glyphweave-pdf.with(${pdfTemplateArguments(template)})`,
        `#include ${JSON.stringify(includePath)}`,
        '',
      ].join('\n'),
    )

    return await runTypstProcess(
      { ...input, rootPath: sourceDir },
      ['compile', wrapperPath, input.outputPath],
      sourceDir,
      GLYPHWEAVE_PDF_PRELUDE_VERSION,
    )
  } finally {
    await rm(workspace, { recursive: true, force: true })
  }
}

function shouldUseHtmlWrapper(wrapper: TypstHtmlWrapperOptions | undefined) {
  return wrapper?.mathStrategy === 'svg-frame'
}

function shouldUsePdfWrapper(wrapper: TypstPdfWrapperOptions | undefined) {
  return wrapper?.injectTemplate !== false
}

function pdfTemplateArguments(template: TypstPdfWrapperOptions | undefined) {
  return [
    `fonts: ${typstStringTuple(template?.fonts)}`,
    `mono-fonts: ${typstStringTuple(template?.monoFonts)}`,
    `lang: ${JSON.stringify(template?.lang ?? 'zh')}`,
    `region: ${JSON.stringify(template?.region ?? 'CN')}`,
  ].join(', ')
}

function typstStringTuple(values: string[] | undefined) {
  const safeValues = values?.filter((value) => value.trim()) ?? []
  if (safeValues.length === 0) return '()'
  if (safeValues.length === 1) return `(${JSON.stringify(safeValues[0])},)`
  return `(${safeValues.map((value) => JSON.stringify(value)).join(', ')})`
}
