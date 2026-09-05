import { chmod, mkdtemp, mkdir, writeFile, rm, stat, utimes } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { createCompilerIdentity } from '@glyphweave/typst'
let root: string
afterEach(async () => {
  vi.unstubAllEnvs()
  if (root) await rm(root, { recursive: true, force: true })
})
it('fingerprints compiler, font and package bytes, additions and removals', async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'glyphweave-environment-'))
  const font = path.join(root, 'font.ttf')
  const binary = path.join(root, 'typst')
  const packages = path.join(root, 'packages')
  await mkdir(packages)
  await writeFile(font, 'font-A')
  await writeFile(binary, `#!/bin/sh\nprintf '%s\\n' 'Family' '  └ ${font}'\n# A\n`)
  await chmod(binary, 0o755)
  vi.stubEnv('TYPST_PACKAGE_PATH', packages)
  vi.stubEnv('TYPST_PACKAGE_CACHE_PATH', packages)
  const identify = createCompilerIdentity()
  let previous = await identify(binary)
  expect(await identify(binary)).toBe(previous)
  const old = await stat(font)
  await writeFile(font, 'font-B')
  await utimes(font, old.atime, old.mtime)
  let next = await identify(binary)
  expect(next).not.toBe(previous)
  previous = next
  await writeFile(path.join(packages, 'data.typ'), 'package-A')
  next = await identify(binary)
  expect(next).not.toBe(previous)
  previous = next
  await writeFile(path.join(packages, 'data.typ'), 'package-B')
  next = await identify(binary)
  expect(next).not.toBe(previous)
  previous = next
  await rm(path.join(packages, 'data.typ'))
  next = await identify(binary)
  expect(next).not.toBe(previous)
  previous = next
  await writeFile(binary, `#!/bin/sh\nprintf '%s\\n' 'Family' '  └ ${font}'\n# B\n`)
  expect(await identify(binary)).not.toBe(previous)
})
