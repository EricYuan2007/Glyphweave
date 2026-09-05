import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { lstat, readdir, readFile, realpath } from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

export function hash(value: string | Buffer) {
  return createHash('sha256').update(value).digest('hex')
}

export async function hashFile(file: string) {
  const digest = createHash('sha256')
  for await (const chunk of createReadStream(file)) digest.update(chunk)
  return digest.digest('hex')
}

/** Content-based inventory: addition, removal, bytes and link targets affect the result. */
export async function snapshotTree(root: string): Promise<Record<string, string>> {
  const files: Record<string, string> = {}
  const actualRoot = await realpath(root)
  async function walk(directory: string, ancestors: Set<string>) {
    const actual = await realpath(directory)
    if (ancestors.has(actual)) throw new Error(`Cyclic directory link: ${directory}`)
    const next = new Set([...ancestors, actual])
    for (const name of (await readdir(directory)).sort()) {
      const file = path.join(directory, name)
      const relative = path.relative(root, file).replace(/\\/g, '/')
      const stat = await lstat(file)
      if (stat.isSymbolicLink()) {
        const target = await realpath(file)
        const rel = path.relative(actualRoot, target)
        if (rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel))
          throw new Error(`Input link escapes article: ${file}`)
        files[`${relative}/@link`] = hash(target)
        if ((await lstat(target)).isDirectory()) await walk(file, next)
        else files[relative] = await hashFile(file)
      } else if (stat.isDirectory()) await walk(file, next)
      else if (stat.isFile()) files[relative] = await hashFile(file)
      else throw new Error(`Unsupported input file: ${file}`)
    }
  }
  await walk(root, new Set())
  return files
}

/** Include installed implementation bytes and lockfiles, not only a manually bumped version. */
export async function implementationIdentity(rootDir: string) {
  const require = createRequire(import.meta.url)
  const entries: Record<string, unknown> = {
    node: process.version,
    platform: process.platform,
    arch: process.arch,
  }
  for (const name of ['schema', 'typst', 'html-adapter']) {
    const entry = require.resolve(`@glyphweave/${name}`)
    const runtime = path.dirname(entry)
    entries[name] = await snapshotTree(runtime)
    const manifest = path.join(runtime, '../package.json')
    entries[`${name}/package`] = await readFile(manifest, 'utf8')
    if (name === 'typst') entries.prelude = await snapshotTree(path.join(runtime, '../prelude'))
  }
  entries.core = await snapshotTree(path.dirname(fileURLToPath(import.meta.url)))
  // Workspace examples inherit dependency resolution from ancestor lockfiles.
  for (let directory = rootDir; ; directory = path.dirname(directory)) {
    for (const name of ['pnpm-lock.yaml', 'package-lock.json', 'yarn.lock']) {
      try {
        entries[path.join(directory, name)] = await readFile(path.join(directory, name), 'utf8')
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      }
    }
    if (path.dirname(directory) === directory) break
  }
  return hash(JSON.stringify(entries))
}
