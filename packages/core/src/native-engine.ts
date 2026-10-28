import { access, readFile } from 'node:fs/promises'
import { constants } from 'node:fs'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import path from 'node:path'
import os from 'node:os'
const execute = promisify(execFile)

/** Workspace builds prepare the bundled engine; installed packages use a supplied executable. */
export async function prepareNativeEngine(binary: string, root: string): Promise<string> {
  if (binary !== 'glyphweave-typst-html') return binary.includes('/') || binary.includes('\\') ? path.resolve(root, binary) : binary
  // Prefer an explicitly installed engine (including CI's verified build artifact).
  for (const directory of (process.env.PATH ?? '').split(path.delimiter).filter(Boolean)) {
    const candidate = path.resolve(directory, process.platform === 'win32' ? `${binary}.exe` : binary)
    if (await access(candidate, constants.X_OK).then(() => true, () => false)) return candidate
  }
  for (let dir = root; ; dir = path.dirname(dir)) {
    const manifest = path.join(dir, 'crates/typst-html/Cargo.toml')
    const text = await readFile(manifest, 'utf8').catch(() => '')
    if (text.includes('name = "glyphweave-typst-html"')) {
      const target = path.join(dir, 'crates/typst-html/target')
      let cargo = 'cargo'
      const rustupCargo = path.join(os.homedir(), '.cargo/bin', process.platform === 'win32' ? 'cargo.exe' : 'cargo')
      if (await access(rustupCargo, constants.X_OK).then(() => true, () => false)) cargo = rustupCargo
      try {
        await execute(cargo, ['build', '--locked', '--release', '--manifest-path', manifest, '--target-dir', target], { cwd: dir, timeout: 1_200_000, maxBuffer: 16 * 1024 * 1024 })
      } catch (error) {
        throw new Error('Could not prepare the native Typst engine. Install current stable Rust (rustup update stable), or configure math.html.binary with a prebuilt executable. Set math.strategy to mathml to explicitly use browser layout.', { cause: error })
      }
      return path.join(target, 'release', process.platform === 'win32' ? `${binary}.exe` : binary)
    }
    if (path.dirname(dir) === dir) return binary
  }
}
