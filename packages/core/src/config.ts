import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { GlyphweaveConfigSchema, defaultConfig } from '@glyphweave/schema'

export async function loadConfig(rootDir: string, configPath = 'glyphweave.config.ts') {
  const fullPath = path.resolve(rootDir, configPath)
  try {
    const mod = await import(`${pathToFileURL(fullPath).href}?t=${Date.now()}`)
    return GlyphweaveConfigSchema.parse(mod.default ?? mod.config ?? {})
  } catch (error: any) {
    if (error?.code === 'ERR_MODULE_NOT_FOUND' || error?.code === 'MODULE_NOT_FOUND') {
      return defaultConfig()
    }
    if (error?.code === 'ENOENT') return defaultConfig()
    throw error
  }
}
