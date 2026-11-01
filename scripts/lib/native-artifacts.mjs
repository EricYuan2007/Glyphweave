import { createHash } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { Buffer } from 'node:buffer'

export const nativeTargets = {
  'darwin-arm64': 'aarch64-apple-darwin',
  'linux-arm64': 'aarch64-unknown-linux-gnu',
  'linux-x64': 'x86_64-unknown-linux-gnu',
}

export async function nativeSourceDigest(root) {
  const files = ['Cargo.toml', 'Cargo.lock']
  async function visit(relative) {
    for (const entry of await readdir(path.join(root, relative), { withFileTypes: true })) {
      const file = path.posix.join(relative, entry.name)
      if (entry.isDirectory()) await visit(file)
      else if (entry.isFile()) files.push(file)
      else throw new Error(`Unexpected native source entry: ${file}`)
    }
  }
  await visit('src')
  const digest = createHash('sha256')
  for (const file of files.sort()) {
    const bytes = await readFile(path.join(root, file))
    digest.update(file + '\0' + bytes.length + '\0').update(bytes)
  }
  return digest.digest('hex')
}

export function validateReceipt(receipt, platform, artifact, sourceSha256) {
  if (
    receipt.platform !== platform ||
    receipt.target !== artifact.target ||
    receipt.sourceSha256 !== sourceSha256 ||
    receipt.sha256 !== artifact.sha256 ||
    receipt.bytes !== artifact.bytes ||
    !/^rustc 1\.99\.1\s/.test(receipt.rustc ?? '')
  )
    throw new Error(
      `Stale or mismatched native build receipt: ${platform}; rebuild with pnpm build:native`,
    )
}

export function parsePlatforms(value) {
  const platforms = value.split(',')
  if (
    !platforms.length ||
    new Set(platforms).size !== platforms.length ||
    platforms.some((platform) => !Object.hasOwn(nativeTargets, platform))
  )
    throw new Error(`Expected distinct native platforms: ${Object.keys(nativeTargets).join(',')}`)
  return platforms.sort()
}

export async function inspectNative(directory, platform) {
  if (!Object.hasOwn(nativeTargets, platform))
    throw new Error(`Unsupported native platform: ${platform}`)
  const filename = path.join(directory, platform, 'glyphweave-typst-html')
  const bytes = await readFile(filename)
  const valid =
    platform === 'darwin-arm64'
      ? bytes.length >= 32 &&
        bytes.readUInt32LE(0) === 0xfeedfacf &&
        bytes.readUInt32LE(4) === 0x0100000c
      : bytes.length >= 64 &&
        bytes.subarray(0, 4).equals(Buffer.from([0x7f, 0x45, 0x4c, 0x46])) &&
        bytes[4] === 2 &&
        bytes[5] === 1 &&
        bytes.readUInt16LE(18) === (platform === 'linux-arm64' ? 183 : 62)
  if (!valid) throw new Error(`Wrong native executable architecture: ${platform}`)
  return {
    target: nativeTargets[platform],
    sha256: createHash('sha256').update(bytes).digest('hex'),
    bytes: bytes.length,
  }
}
