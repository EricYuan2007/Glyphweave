import { cp, mkdir, mkdtemp, readFile, rm, writeFile, chmod } from 'node:fs/promises'
import path from 'node:path'
import { execa } from 'execa'
import {
  inspectNative,
  parsePlatforms,
  nativeSourceDigest,
  validateReceipt,
} from './lib/native-artifacts.mjs'
const root = process.cwd()
const platforms = parsePlatforms(
  process.env.GLYPHWEAVE_NATIVE_PLATFORMS ?? `${process.platform}-${process.arch}`,
)
const output = path.resolve(process.argv[2] ?? 'dist/packages')
await mkdir(output, { recursive: true })
const packageNames = ['glyphweave', 'astro']
const versions = new Map()
for (const name of packageNames) {
  const metadata = JSON.parse(
    await readFile(path.join(root, 'packages', name, 'package.json'), 'utf8'),
  )
  versions.set(metadata.name, metadata.version)
}
const stage = await mkdtemp(path.join(output, '.pack-'))
try {
  for (const name of packageNames) {
    const source = path.join(root, 'packages', name)
    const target = path.join(stage, name)
    const metadata = JSON.parse(await readFile(path.join(source, 'package.json'), 'utf8'))
    await mkdir(target)
    for (const file of metadata.files.filter((file) => file !== 'native'))
      await cp(path.join(source, file), path.join(target, file), { recursive: true })
    if (name === 'glyphweave') {
      const inventory = {}
      const sourceSha256 = await nativeSourceDigest(path.join(root, 'crates/typst-html'))
      for (const platform of platforms) {
        inventory[platform] = await inspectNative(path.join(source, 'native'), platform)
        const receipt = JSON.parse(
          await readFile(path.join(source, 'native', platform, 'build.json'), 'utf8'),
        )
        validateReceipt(receipt, platform, inventory[platform], sourceSha256)
        inventory[platform] = { ...inventory[platform], sourceSha256, rustc: receipt.rustc }
        await cp(path.join(source, 'native', platform), path.join(target, 'native', platform), {
          recursive: true,
        })
        await chmod(path.join(target, 'native', platform, 'glyphweave-typst-html'), 0o755)
      }
      await writeFile(
        path.join(target, 'native/manifest.json'),
        JSON.stringify({ version: 1, platforms: inventory }, null, 2) + '\n',
      )
      await chmod(path.join(target, 'bin/native.mjs'), 0o755)
      metadata.os = [...new Set(platforms.map((platform) => platform.split('-')[0]))]
      metadata.cpu = [...new Set(platforms.map((platform) => platform.split('-')[1]))]
    }
    for (const [dependency, version] of Object.entries(metadata.dependencies ?? {})) {
      if (version.startsWith('workspace:')) {
        const resolved = versions.get(dependency)
        if (!resolved) throw new Error(`Unknown workspace dependency: ${dependency}`)
        metadata.dependencies[dependency] = resolved
      }
    }
    await writeFile(path.join(target, 'package.json'), JSON.stringify(metadata, null, 2))
    await cp(path.join(root, 'LICENSE'), path.join(target, 'LICENSE'))
    await execa('npm', ['pack', '--ignore-scripts', '--pack-destination', output], {
      cwd: target,
      stdio: 'inherit',
    })
  }
} finally {
  await rm(stage, { recursive: true, force: true })
}
