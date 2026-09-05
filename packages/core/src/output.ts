import { lstat, readdir, mkdir, open, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { GlyphweaveConfig } from '@glyphweave/schema'

export const OWNER_FILE = '.glyphweave-owner.json'

export function isWithin(parent: string, target: string) {
  const relative = path.relative(parent, target)
  return (
    relative !== '' &&
    relative !== '..' &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  )
}

/** Reject aliases, symlinks, project ancestors and source/output overlap before any mutation. */
export async function validateOutputRoot(rootDir: string, config: GlyphweaveConfig) {
  const root = await realpath(rootDir)
  const output = path.resolve(root, config.output.root)
  const content = path.resolve(root, config.content.root)
  if (
    !isWithin(root, output) ||
    output === content ||
    isWithin(content, output) ||
    isWithin(output, content)
  ) {
    throw new Error(`Unsafe output directory: ${config.output.root}`)
  }
  const parts = path.relative(root, output).split(path.sep)
  if (
    parts.some((part) =>
      ['.git', 'node_modules', 'packages', 'src', 'docs', '.github'].includes(part),
    )
  ) {
    throw new Error(`Unsafe output directory: ${config.output.root}`)
  }
  let current = root
  for (const part of parts) {
    current = path.join(current, part)
    try {
      const stat = await lstat(current)
      if (stat.isSymbolicLink() || !stat.isDirectory())
        throw new Error(`Unsafe output path: ${current}`)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
  }
  return output
}

export async function ownOutput(rootDir: string, config: GlyphweaveConfig) {
  const output = await validateOutputRoot(rootDir, config)
  await mkdir(output, { recursive: true })
  const entries = await readdir(output)
  if (
    !entries.includes(OWNER_FILE) &&
    entries.some((name) => !['generated', 'logs', 'content-index.json'].includes(name))
  ) {
    throw new Error('Refusing to adopt a non-empty output directory with unrelated files')
  }
  const marker = path.join(output, OWNER_FILE)
  const expected = JSON.stringify({ generator: 'glyphweave', root: await realpath(rootDir) })
  try {
    await writeFile(marker, expected, { flag: 'wx' })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
    if ((await readFile(marker, 'utf8')) !== expected) throw new Error('Output ownership mismatch')
  }
  const generations = path.join(output, 'generations')
  await mkdir(generations, { recursive: true })
  if ((await lstat(generations)).isSymbolicLink())
    throw new Error('Generation store must not be a symlink')
  return output
}

/** One writer per output. Locks are never stolen automatically after a process crash. */
export async function lockOutput(output: string) {
  const lockPath = path.join(output, '.build.lock')
  const handle = await open(lockPath, 'wx').catch((error) => {
    throw new Error(
      `Output is locked: ${lockPath}; check for another build before removing a stale lock`,
      { cause: error },
    )
  })
  await handle.writeFile(String(process.pid))
  return async () => {
    await handle.close()
    await rm(lockPath, { force: true })
  }
}
