import path from 'node:path'
import type { Command } from 'commander'
import { buildAll, GLYPHWEAVE_VERSION, loadConfig } from '@glyphweave/core'

export function registerBuildCommand(program: Command) {
  program
    .command('build')
    .description('Build Typst posts into Glyphweave artifacts')
    .option('--root <dir>', 'project root directory', process.cwd())
    .option('-c, --config <path>', 'config file path')
    .option('--no-cache', 'force compilation of every published post')
    .option('--json', 'print machine-readable build results')
    .action(async (options) => {
      const rootDir = path.resolve(options.root)
      const config = await loadConfig(rootDir, options.config)
      if (options.cache === false) config.cache.enabled = false
      const result = await buildAll(rootDir, config)
      if (options.json) {
        console.log(JSON.stringify(result, null, 2))
        return
      }
      console.log(`Glyphweave v${GLYPHWEAVE_VERSION}`)
      console.log(`Built ${result.built.length} post(s), skipped ${result.skipped.length}`)
      console.log(`Cache: ${result.cache.reused} reused, ${result.cache.compiled} compiled`)
      for (const built of result.built) {
        for (const diagnostic of built.manifest.diagnostics) {
          if (diagnostic.severity !== 'info')
            console.warn(
              `${diagnostic.severity} [${diagnostic.code}] ${built.post.metadata.slug}: ${diagnostic.message}`,
            )
        }
        const math = built.manifest.capture.math
        console.log(
          `✓ ${built.post.metadata.slug}: html ready, toc ready, math ${math.renderedCount}/${math.sourceFormulaCount} rendered (${math.nativeMathml} MathML, ${math.typstFrameSvg} SVG)`,
        )
      }
    })
}
