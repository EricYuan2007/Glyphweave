import { access } from 'node:fs/promises'
import { constants } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export async function prepareNativeEngine(binary: string, root: string): Promise<string> {
  const executable =
    process.platform === 'win32' && !binary.endsWith('.exe') ? `${binary}.exe` : binary
  const candidates =
    binary.includes('/') || binary.includes('\\')
      ? [path.resolve(root, binary)]
      : (process.env.PATH ?? '')
          .split(path.delimiter)
          .filter(Boolean)
          .map((directory) => path.resolve(directory, executable))
  if (binary === 'glyphweave-typst-html')
    candidates.push(
      fileURLToPath(
        new URL(`../../native/${process.platform}-${process.arch}/${executable}`, import.meta.url),
      ),
    )
  for (const candidate of candidates) {
    if (
      await access(candidate, constants.X_OK).then(
        () => true,
        () => false,
      )
    )
      return candidate
  }
  throw new Error(
    'Native Typst engine is not installed. Configure math.html.binary or add glyphweave-typst-html to PATH. Developers can run pnpm build:native explicitly.',
  )
}
