import { access } from 'node:fs/promises'
import { constants } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export async function bundledNativeEngine(): Promise<string> {
  const platform = `${process.platform}-${process.arch}`
  const binary = fileURLToPath(
    new URL(`../../native/${platform}/glyphweave-typst-html`, import.meta.url),
  )
  await access(binary, constants.X_OK).catch(() => {
    throw new Error(
      `No bundled Glyphweave native engine for ${platform}. Install a matching distribution or configure math.html.binary explicitly.`,
    )
  })
  return binary
}

export async function prepareNativeEngine(binary: string, root: string): Promise<string> {
  // Resolve the actual executable, never the npm launcher: cache identities must
  // include the compiler bytes, and a missing bundle must not recurse via PATH.
  if (binary === 'glyphweave-typst-html') return bundledNativeEngine()
  const executable =
    process.platform === 'win32' && !binary.endsWith('.exe') ? `${binary}.exe` : binary
  const candidates =
    binary.includes('/') || binary.includes('\\')
      ? [path.resolve(root, binary)]
      : (process.env.PATH ?? '')
          .split(path.delimiter)
          .filter(Boolean)
          .map((directory) => path.resolve(directory, executable))
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
