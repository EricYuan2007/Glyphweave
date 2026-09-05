import { writeFile, rm } from 'node:fs/promises'
import path from 'node:path'
import type { Command } from 'commander'
import { loadConfig, prepareOutput } from '@glyphweave/core'
import { detectTypst } from '@glyphweave/typst'

export function registerDoctorCommand(program: Command) {
  program
    .command('doctor')
    .description('Check local Glyphweave prerequisites')
    .option('--root <dir>', 'project root directory', process.cwd())
    .option('-c, --config <path>', 'config file path')
    .action(async (options) => {
      const rootDir = path.resolve(options.root)
      const config = await loadConfig(rootDir, options.config)
      const typst = await detectTypst(config.typst.binary)
      const output = await prepareOutput(rootDir, config)
      const probe = path.join(output, `.doctor-${process.pid}`)
      await writeFile(probe, '', { flag: 'wx' })
      await rm(probe)
      console.log('Glyphweave Doctor')
      console.log(`✓ Node.js ${process.version}`)
      console.log(`✓ Typst found: ${typst.binary}`)
      console.log(`✓ Typst version: ${typst.version}`)
      console.log('✓ MathML: requires a successful build')
      console.log('✓ Config valid')
      console.log(`✓ Output directory writable: ${config.output.root}`)
    })
}
