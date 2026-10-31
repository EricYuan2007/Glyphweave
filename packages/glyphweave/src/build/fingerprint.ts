import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { lstat, readdir, readFile, realpath } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export function hash(value: string | Buffer) {
  return createHash('sha256').update(value).digest('hex')
}

export async function hashFile(file: string) {
  const digest = createHash('sha256')
  for await (const chunk of createReadStream(file)) digest.update(chunk)
  return digest.digest('hex')
}

export class InvalidTree extends Error {}

/** Content-based inventory: addition, removal, bytes and link targets affect the result. */
export async function snapshotTree(root: string): Promise<Record<string, string>> {
  const files: Record<string, string> = {}
  const actualRoot = await realpath(root)
  async function walk(directory: string, ancestors: Set<string>) {
    const actual = await realpath(directory)
    if (ancestors.has(actual)) throw new InvalidTree(`Cyclic directory link: ${directory}`)
    const next = new Set([...ancestors, actual])
    for (const name of (await readdir(directory)).sort()) {
      const file = path.join(directory, name)
      const relative = path.relative(root, file).replace(/\\/g, '/')
      const stat = await lstat(file)
      if (stat.isSymbolicLink()) {
        const target = await realpath(file)
        const rel = path.relative(actualRoot, target)
        if (rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel))
          throw new InvalidTree(`Input link escapes article: ${file}`)
        files[`${relative}/@link`] = hash(target)
        if ((await lstat(target)).isDirectory()) await walk(file, next)
        else files[relative] = await hashFile(file)
      } else if (stat.isDirectory()) await walk(file, next)
      else if (stat.isFile()) files[relative] = await hashFile(file)
      else throw new InvalidTree(`Unsupported input file: ${file}`)
    }
  }
  await walk(root, new Set())
  return files
}

/** Include installed implementation bytes and lockfiles, not only a manually bumped version. */
export async function implementationIdentity(rootDir: string) {
  const entries: Record<string, unknown> = {
    node: process.version,
    platform: process.platform,
    arch: process.arch,
  }
  const runtime = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  entries.runtime = await snapshotTree(runtime)
  entries.package = await readFile(path.join(runtime, '../package.json'), 'utf8')
  entries.prelude = await snapshotTree(path.join(runtime, '../prelude'))
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

/** The native bridge embeds Typst and bundled fonts; hash its actual executable bytes. */
export async function nativeRendererIdentity(binary: string) {
  return hashFile(binary)
}
