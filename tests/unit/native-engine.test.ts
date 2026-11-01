import { expect, it } from 'vitest'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { prepareNativeEngine } from '../../packages/glyphweave/src/build/native-engine.js'

it('resolves an explicit custom native executable without substituting the bundle', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'glyphweave-custom-engine-'))
  try {
    await writeFile(path.join(root, 'custom-engine'), '#!/bin/sh\nexit 0\n', { mode: 0o755 })
    expect(await prepareNativeEngine('./custom-engine', root)).toBe(
      path.join(root, 'custom-engine'),
    )
    await expect(prepareNativeEngine('./absent', root)).rejects.toThrow('not installed')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
