import { chmod, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { execa } from 'execa'
import { describe, expect, it } from 'vitest'

const cliPath = path.resolve('packages/cli/src/index.ts')
const repoRoot = path.resolve('.')

describe('CLI', () => {
  it('prints doctor output when configured Typst is available', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'glyphweave-cli-doctor-'))
    const fakeTypst = path.join(root, 'fake-typst')
    await writeFile(fakeTypst, '#!/usr/bin/env sh\necho "typst 0.14.2"\n')
    await chmod(fakeTypst, 0o755)
    await writeFile(
      path.join(root, 'glyphweave.config.ts'),
      `export default { typst: { binary: ${JSON.stringify(fakeTypst)} } }\n`,
    )

    const result = await execa('pnpm', ['exec', 'tsx', cliPath, 'doctor', '--root', root])

    expect(result.stdout).toContain('Glyphweave Doctor')
    expect(result.stdout).toContain('Config valid')
    expect(result.stdout).toContain('typst 0.14.2')
  })

  it('cleans the configured output directory', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'glyphweave-cli-'))
    await mkdir(path.join(root, '.glyphweave'), { recursive: true })
    await writeFile(path.join(root, '.glyphweave/marker.txt'), 'generated')

    const result = await execa('pnpm', ['exec', 'tsx', cliPath, 'clean', '--root', root], {
      cwd: repoRoot,
    })

    expect(result.stdout).toContain('Removed .glyphweave')
    await expect(readFile(path.join(root, '.glyphweave/marker.txt'), 'utf-8')).rejects.toThrow()
  })
})
