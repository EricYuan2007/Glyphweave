import { createHash } from 'node:crypto'
import { readFile, realpath } from 'node:fs/promises'
import path from 'node:path'
import { isWithin } from '../paths.js'

/** Host-owned data is opaque to compilation; no blog publication policy lives here. */
export interface DocumentInput {
  id: string
  postDir: string
  sourcePath: string
  metadataPath: string
  assetDir?: string
  sourceHash: string
  metadataHash: string
  creationTimestamp: number
  pdf: boolean
  data: Record<string, unknown>
}
export async function documentInput(options: {
  id: string
  sourcePath: string
  metadataPath?: string
  directory?: string
  creationTimestamp: number
  pdf: boolean
  data?: Record<string, unknown>
}): Promise<DocumentInput> {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(options.id)) throw new Error('Invalid document ID')
  const sourcePath = await realpath(options.sourcePath)
  const postDir = await realpath(options.directory ?? path.dirname(sourcePath))
  if (!isWithin(postDir, sourcePath)) throw new Error('Source escapes document directory')
  const metadataPath = options.metadataPath ? await realpath(options.metadataPath) : sourcePath
  if (!isWithin(postDir, metadataPath)) throw new Error('Metadata escapes document directory')
  const hash = (value: string | Buffer) =>
    'sha256:' + createHash('sha256').update(value).digest('hex')
  return {
    id: options.id,
    postDir,
    sourcePath,
    metadataPath,
    assetDir: path.join(postDir, 'assets'),
    sourceHash: hash(await readFile(sourcePath)),
    metadataHash: hash(await readFile(metadataPath)),
    creationTimestamp: options.creationTimestamp,
    pdf: options.pdf,
    data: options.data ?? {},
  }
}
