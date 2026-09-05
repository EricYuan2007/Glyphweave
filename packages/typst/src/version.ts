import { execa } from 'execa'
import type { TypstInfo, TypstVersion } from './types.js'

export async function detectTypst(binary: string): Promise<TypstInfo> {
  const result = await execa(binary, ['--version'], { timeout: 10_000 })
  assertSupportedTypst(result.stdout)
  return {
    binary,
    version: result.stdout.trim(),
  }
}

export function parseTypstVersion(output: string): TypstVersion {
  const match = output.match(/\btypst\s+(\d+)\.(\d+)\.(\d+)\b/i)
  if (!match) throw new Error(`Unable to parse Typst version: ${output.trim()}`)
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  }
}

export function assertSupportedTypst(output: string): void {
  const version = parseTypstVersion(output)
  if (version.major === 0 && version.minor === 15) return
  if (version.major > 0 || version.minor > 15)
    throw new Error(`Untested Typst version: ${output.trim()}; supported compiler range is 0.15.x`)
  throw new Error(
    `Glyphweave requires Typst 0.15.0 or newer; found ${output.trim()}. Upgrade with: brew update && brew upgrade typst`,
  )
}
