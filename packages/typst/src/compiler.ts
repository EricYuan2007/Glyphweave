import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
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
    return runTypstWrapper(input, 'html')
  }
  return runTypst(input, ['compile', '--features', 'html', '--format', 'html'])
}

export async function compileTypstPdf(input: CompileInput): Promise<CompileOutput> {
  if (shouldUsePdfWrapper(input.wrapper?.pdfTemplate)) {
    return runTypstWrapper(input, 'pdf')
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
  const rootArgs = [
    ...(input.rootPath ? ['--root', input.rootPath] : []),
    ...(input.creationTimestamp !== undefined
      ? ['--creation-timestamp', String(input.creationTimestamp)]
      : []),
  ]
  const result = await execa(input.binary, [...args.slice(0, 1), ...rootArgs, ...args.slice(1)], {
    cwd,
    timeout: input.timeoutMs ?? 30_000,
    reject: false,
  })
  const diagnostics = parseTypstDiagnostics(
    [result.stdout, result.stderr].filter(Boolean).join('\n'),
  )

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

async function runTypstWrapper(
  input: CompileInput,
  format: 'html' | 'pdf',
): Promise<CompileOutput> {
  const workspace = await mkdtemp(path.join(os.tmpdir(), `glyphweave-typst-${format}-`))
  try {
    const sourceDir = path.join(workspace, 'source')
    await cp(input.cwd, sourceDir, { recursive: true, verbatimSymlinks: true })
    const wrapperDir = path.join(sourceDir, '__glyphweave__')
    await mkdir(wrapperDir, { recursive: true })
    const name = `glyphweave-${format}`
    const prelude = await readFile(new URL(`../prelude/${name}.typ`, import.meta.url), 'utf8')
    await writeFile(path.join(wrapperDir, `${name}.typ`), prelude)
    const relativeSource = path.relative(input.cwd, input.inputPath).replace(/\\/g, '/')
    const wrapperPath = path.join(wrapperDir, `main.${format}.typ`)
    const show =
      format === 'html' ? name : `${name}.with(${pdfTemplateArguments(input.wrapper?.pdfTemplate)})`
    await writeFile(
      wrapperPath,
      [
        `#import "${name}.typ": ${name}`,
        `#show: ${show}`,
        `#include ${JSON.stringify(`../${relativeSource}`)}`,
        '',
      ].join('\n'),
    )
    return await runTypstProcess(
      { ...input, rootPath: sourceDir },
      [
        'compile',
        ...(format === 'html' ? ['--features', 'html', '--format', 'html'] : []),
        wrapperPath,
        input.outputPath,
      ],
      sourceDir,
      format === 'html' ? GLYPHWEAVE_HTML_PRELUDE_VERSION : GLYPHWEAVE_PDF_PRELUDE_VERSION,
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
