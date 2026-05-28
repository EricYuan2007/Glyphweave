import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { execa } from 'execa'

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
}

export interface CompileOutput {
  outputPath: string
  stdout: string
  stderr: string
}

export async function detectTypst(binary: string): Promise<TypstInfo> {
  const result = await execa(binary, ['--version'])
  return {
    binary,
    version: result.stdout.trim(),
  }
}

export async function compileTypstHtml(input: CompileInput): Promise<CompileOutput> {
  return runTypst(input, ['compile', '--features', 'html', '--format', 'html'])
}

export async function compileTypstPdf(input: CompileInput): Promise<CompileOutput> {
  return runTypst(input, ['compile'])
}

async function runTypst(input: CompileInput, args: string[]): Promise<CompileOutput> {
  await mkdir(path.dirname(input.outputPath), { recursive: true })
  const result = await execa(input.binary, [...args, input.inputPath, input.outputPath], {
    cwd: input.cwd,
    timeout: input.timeoutMs ?? 30_000,
    reject: false,
  })

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
  }
}
