import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { GlyphweaveContentIndex } from '@glyphweave/schema'

export async function readGlyphweaveContentIndex(
  rootDir: string,
  indexPath = '.glyphweave/content-index.json',
): Promise<GlyphweaveContentIndex> {
  const fullPath = path.resolve(rootDir, indexPath)
  return JSON.parse(await readFile(fullPath, 'utf-8')) as GlyphweaveContentIndex
}
