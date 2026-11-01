import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import {
  parsePlatforms,
  inspectNative,
  validateReceipt,
} from '../../scripts/lib/native-artifacts.mjs'

test('release platform list rejects duplicates, unknown targets and empty input', () => {
  assert.deepEqual(parsePlatforms('linux-x64,darwin-arm64,linux-arm64'), [
    'darwin-arm64',
    'linux-arm64',
    'linux-x64',
  ])
  for (const value of ['', 'linux-x64,linux-x64', 'linux-ia32', '../linux-x64', 'toString'])
    assert.throws(() => parsePlatforms(value))
})

test('assembly rejects mixed source revisions, altered binary bytes and wrong toolchains', () => {
  const artifact = { target: 'aarch64-unknown-linux-gnu', sha256: 'binary', bytes: 64 }
  const receipt = {
    ...artifact,
    platform: 'linux-arm64',
    sourceSha256: 'source',
    rustc: 'rustc 1.99.1 (58cf8f9c3 2026-10-13)',
  }
  validateReceipt(receipt, 'linux-arm64', artifact, 'source')
  for (const patch of [
    { sourceSha256: 'old' },
    { sha256: 'altered' },
    { rustc: 'rustc 1.98.0' },
    { platform: 'linux-x64' },
    { bytes: 0 },
  ])
    assert.throws(
      () => validateReceipt({ ...receipt, ...patch }, 'linux-arm64', artifact, 'source'),
      /receipt/,
    )
})

test('packaging rejects a renamed binary for the wrong Linux architecture', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'glyphweave-native-header-'))
  try {
    const bytes = Buffer.alloc(64)
    bytes.set([0x7f, 0x45, 0x4c, 0x46, 2, 1])
    bytes.writeUInt16LE(183, 18)
    for (const platform of ['linux-arm64', 'linux-x64']) {
      await mkdir(path.join(root, platform))
      await writeFile(path.join(root, platform, 'glyphweave-typst-html'), bytes)
    }
    assert.match((await inspectNative(root, 'linux-arm64')).sha256, /^[a-f0-9]{64}$/)
    await assert.rejects(inspectNative(root, 'linux-x64'), /architecture/)
    await assert.rejects(inspectNative(root, 'darwin-arm64'), /ENOENT/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
