import { createHash } from 'node:crypto'
import { createReadStream, constants } from 'node:fs'
import { access, lstat, readdir, realpath } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { execa } from 'execa'

/** A per-build memo only; a new CLI invocation always rehashes actual compiler/font bytes. */
export function createCompilerIdentity() {
  const memo = new Map<string, { signature: string; digest: string }>()
  async function digestFile(file: string): Promise<string> {
    const stat = await lstat(file, { bigint: true })
    if (stat.isSymbolicLink()) return digestFile(await realpath(file))
    const signature = [stat.ino, stat.size, stat.mtimeNs, stat.ctimeNs].join(':')
    const previous = memo.get(file)
    if (previous?.signature === signature) return previous.digest
    const hash = createHash('sha256')
    for await (const chunk of createReadStream(file)) hash.update(chunk)
    const digest = hash.digest('hex')
    memo.set(file, { signature, digest })
    return digest
  }
  async function inventory(directory: string, seen = new Set<string>()): Promise<unknown> {
    try {
      const actual = await realpath(directory)
      if (seen.has(actual)) throw new Error('Cyclic package directory')
      const next = new Set([...seen, actual])
      const entries: unknown[] = []
      for (const name of (await readdir(directory)).sort()) {
        const full = await realpath(path.join(directory, name))
        const stat = await lstat(full)
        entries.push([
          name,
          stat.isDirectory() ? await inventory(full, next) : await digestFile(full),
        ])
      }
      return entries
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
      throw error
    }
  }
  return async (binary: string): Promise<string> => {
    let executable: string | undefined
    for (const candidate of binary.includes('/') || binary.includes('\\')
      ? [path.resolve(binary)]
      : (process.env.PATH ?? '').split(path.delimiter).map((dir) => path.join(dir, binary))) {
      try {
        await access(candidate, constants.X_OK)
        executable = await realpath(candidate)
        break
      } catch {
        /* try the next PATH entry */
      }
    }
    if (!executable) throw new Error(`Cannot fingerprint compiler: ${binary}`)
    const fonts = await execa(executable, ['fonts', '--variants'], { timeout: 30_000 })
    const files = [
      ...new Set(
        fonts.stdout.split('\n').flatMap((line) => {
          const candidate = line.match(/[├└] (.+)$/)?.[1]?.replace(/ \(Variable\)$/, '')
          return candidate && path.isAbsolute(candidate) ? [candidate] : []
        }),
      ),
    ].sort()
    const fontDigests: unknown[] = []
    for (const file of files) fontDigests.push([file, await digestFile(file)])
    const home = os.homedir()
    const data =
      process.platform === 'darwin'
        ? path.join(home, 'Library/Application Support')
        : (process.env.XDG_DATA_HOME ?? path.join(home, '.local/share'))
    const cache =
      process.platform === 'darwin'
        ? path.join(home, 'Library/Caches')
        : (process.env.XDG_CACHE_HOME ?? path.join(home, '.cache'))
    const packages = [
      process.env.TYPST_PACKAGE_PATH ?? path.join(data, 'typst/packages'),
      process.env.TYPST_PACKAGE_CACHE_PATH ?? path.join(cache, 'typst/packages'),
    ]
    const packageDigests = []
    for (const directory of packages) packageDigests.push([directory, await inventory(directory)])
    const environment = Object.fromEntries(
      Object.entries(process.env)
        .filter(
          ([name]) =>
            name.startsWith('TYPST_') ||
            ['SOURCE_DATE_EPOCH', 'TZ', 'LANG', 'LC_ALL'].includes(name),
        )
        .sort(([a], [b]) => a.localeCompare(b)),
    )
    return createHash('sha256')
      .update(
        JSON.stringify({
          executable,
          binary: await digestFile(executable),
          fonts: fonts.stdout,
          fontDigests,
          packageDigests,
          environment,
        }),
      )
      .digest('hex')
  }
}
