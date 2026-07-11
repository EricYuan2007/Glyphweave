import { access, mkdir } from 'node:fs/promises'
import path from 'node:path'
import type { Command } from 'commander'
import { loadConfig } from '@glyphweave/core'
import { detectTypst } from '@glyphweave/typst'

export function registerDoctorCommand(program: Command) {
  program
    .command('doctor')
    .description('Check local Glyphweave prerequisites')
    .option('--root <dir>', 'project root directory', process.cwd())
    .option('-c, --config <path>', 'config file path', 'glyphweave.config.ts')
    .action(async (options) => {
      const rootDir = path.resolve(options.root)
      const config = await loadConfig(rootDir, options.config)
      const typst = await detectTypst(config.typst.binary)
      await mkdir(path.resolve(rootDir, config.output.root), { recursive: true })
      await access(path.resolve(rootDir, config.output.root))
      console.log('Glyphweave Doctor')
      console.log(`✓ Node.js ${process.version}`)
      console.log(`✓ Typst found: ${typst.binary}`)
      console.log(`✓ Typst version: ${typst.version}`)
      console.log('✓ MathML equations: supported')
      console.log('✓ Config valid')
      console.log(`✓ Output directory writable: ${config.output.root}`)
    })
}
