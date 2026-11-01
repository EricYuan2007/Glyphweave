import { execa } from 'execa'
import { chmod, copyFile, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import {
  nativeTargets,
  inspectNative,
  parsePlatforms,
  nativeSourceDigest,
} from './lib/native-artifacts.mjs'
const platform = process.argv[2] ?? `${process.platform}-${process.arch}`
parsePlatforms(platform)
const target = nativeTargets[platform]
if (!target) throw new Error(`Unsupported native build platform: ${platform}`)
const sourceSha256 = await nativeSourceDigest('crates/typst-html')
await execa(
  'cargo',
  [
    'build',
    '--locked',
    '--release',
    '--target',
    target,
    '--manifest-path',
    'crates/typst-html/Cargo.toml',
  ],
  { stdio: 'inherit' },
)
if ((await nativeSourceDigest('crates/typst-html')) !== sourceSha256)
  throw new Error('Native sources changed during compilation; rebuild before packaging')
const name = 'glyphweave-typst-html'
const directory = path.join('packages/glyphweave/native', platform)
await mkdir(directory, { recursive: true })
await copyFile(
  path.join(process.env.CARGO_TARGET_DIR ?? 'crates/typst-html/target', target, 'release', name),
  path.join(directory, name),
)
await chmod(path.join(directory, name), 0o755)
const receipt = {
  platform,
  ...(await inspectNative('packages/glyphweave/native', platform)),
  sourceSha256,
  rustc: (await execa('rustc', ['--version'])).stdout,
}
await writeFile(path.join(directory, 'build.json'), JSON.stringify(receipt, null, 2) + '\n')
console.log(JSON.stringify(receipt))
