import path from 'node:path'
import type { Command } from 'commander'
import { clean, loadConfig } from '@glyphweave/core'

export function registerCleanCommand(program: Command) {
  program
    .command('clean')
    .description('Remove the Glyphweave output directory')
    .option('--root <dir>', 'project root directory', process.cwd())
    .option('-c, --config <path>', 'config file path', 'glyphweave.config.ts')
    .action(async (options) => {
      const rootDir = path.resolve(options.root)
      const config = await loadConfig(rootDir, options.config)
      await clean(rootDir, config)
      console.log(`Removed ${config.output.root}`)
    })
}
