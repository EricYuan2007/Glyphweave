import { readFile } from 'node:fs/promises'
import type { SourceFormula } from './types.js'

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
