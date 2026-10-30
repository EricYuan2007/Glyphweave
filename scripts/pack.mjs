import { cp, mkdir, mkdtemp, readFile, rm, writeFile, chmod } from 'node:fs/promises'
import path from 'node:path'
import { execa } from 'execa'
const root = process.cwd()
const output = path.resolve(process.argv[2] ?? 'dist/packages')
await mkdir(output, { recursive: true })
const stage = await mkdtemp(path.join(output, '.pack-'))
try {
  for (const name of ['glyphweave', 'astro']) {
    const source = path.join(root, 'packages', name)
    const target = path.join(stage, name)
    const metadata = JSON.parse(await readFile(path.join(source, 'package.json'), 'utf8'))
    await mkdir(target)
    for (const file of metadata.files)
      await cp(path.join(source, file), path.join(target, file), { recursive: true })
    if (name === 'glyphweave') {
      const binary = `native/${process.platform}-${process.arch}/glyphweave-typst-html${process.platform === 'win32' ? '.exe' : ''}`
      await chmod(path.join(target, binary), 0o755)
      metadata.bin['glyphweave-typst-html'] = `./${binary}`
      metadata.os = [process.platform]
      metadata.cpu = [process.arch]
    }
    for (const [dependency, version] of Object.entries(metadata.dependencies ?? {})) {
      if (version.startsWith('workspace:')) metadata.dependencies[dependency] = '0.2.0'
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
