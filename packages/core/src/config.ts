import { access } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { GlyphweaveConfigSchema, defaultConfig } from '@glyphweave/schema'

/** Load a project-relative config. Only an absent implicit default uses defaults. */
export async function loadConfig(rootDir: string, configPath?: string) {
  const fullPath = path.resolve(rootDir, configPath ?? 'glyphweave.config.ts')
  try {
    await access(fullPath)
  } catch (error) {
    if (configPath === undefined && (error as NodeJS.ErrnoException).code === 'ENOENT')
      return defaultConfig()
    throw new Error(`Cannot read config ${fullPath}`, { cause: error })
  }
  try {
    const mod = await import(`${pathToFileURL(fullPath).href}?t=${Date.now()}`)
    return GlyphweaveConfigSchema.parse(mod.default ?? mod.config ?? {})
  } catch (error) {
    throw new Error(
      `Invalid config ${fullPath}: ${error instanceof Error ? error.message : error}`,
      { cause: error },
    )
  }
}
