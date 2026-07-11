import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { Command } from 'commander'
import { loadConfig, resolvePostOutputDir } from '@glyphweave/core'

export function registerInspectCommand(program: Command) {
  program
    .command('inspect')
    .description('Inspect a built post')
    .argument('<slug>', 'post slug')
    .option('--root <dir>', 'project root directory', process.cwd())
    .option('-c, --config <path>', 'config file path', 'glyphweave.config.ts')
    .action(async (slug, options) => {
      const rootDir = path.resolve(options.root)
      const config = await loadConfig(rootDir, options.config)
      const postOutput = resolvePostOutputDir(rootDir, config, slug)
      const manifest = JSON.parse(await readFile(path.join(postOutput, 'manifest.json'), 'utf-8'))
      const toc = JSON.parse(await readFile(path.join(postOutput, 'toc.json'), 'utf-8'))
      console.log(JSON.stringify({ manifest, toc }, null, 2))
    })
}
