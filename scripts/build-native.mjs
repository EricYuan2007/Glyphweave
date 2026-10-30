import { execa } from 'execa'
import { chmod, copyFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
await execa(
  'cargo',
  ['build', '--locked', '--release', '--manifest-path', 'crates/typst-html/Cargo.toml'],
  { stdio: 'inherit' },
)
const name = `glyphweave-typst-html${process.platform === 'win32' ? '.exe' : ''}`
const directory = path.join('packages/glyphweave/native', `${process.platform}-${process.arch}`)
await mkdir(directory, { recursive: true })
await copyFile(path.join('crates/typst-html/target/release', name), path.join(directory, name))
await chmod(path.join(directory, name), 0o755)
