#!/usr/bin/env node
import { access, mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { Command } from 'commander'
import { buildAll, clean, loadConfig, resolvePostOutputDir, GLYPHWEAVE_VERSION } from '@glyphweave/core'
import { detectTypst } from '@glyphweave/typst'

const program = new Command()

program.name('glyphweave').description('Typst-to-web blog artifact pipeline').version(GLYPHWEAVE_VERSION)

program
  .command('build')
  .description('Build Typst posts into Glyphweave artifacts')
  .option('--root <dir>', 'project root directory', process.cwd())
  .option('-c, --config <path>', 'config file path', 'glyphweave.config.ts')
  .action(async (options) => {
    const rootDir = path.resolve(options.root)
    const config = await loadConfig(rootDir, options.config)
    const result = await buildAll(rootDir, config)
    console.log(`Glyphweave v${GLYPHWEAVE_VERSION}`)
    console.log(`Built ${result.built.length} post(s), skipped ${result.skipped.length}`)
    for (const built of result.built) {
      const math = built.manifest.capture.math
      console.log(
        `✓ ${built.post.metadata.slug}: html compiled, toc generated, math ${math.typstFrameSvg}/${math.sourceFormulaCount} frame(s)`,
      )
    }
  })

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
    const manifestPath = path.join(postOutput, 'manifest.json')
    const tocPath = path.join(postOutput, 'toc.json')
    const manifest = JSON.parse(await readFile(manifestPath, 'utf-8'))
    const toc = JSON.parse(await readFile(tocPath, 'utf-8'))
    console.log(JSON.stringify({ manifest, toc }, null, 2))
  })

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
    console.log('✓ Config valid')
    console.log(`✓ Output directory writable: ${config.output.root}`)
  })

program.parseAsync().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
