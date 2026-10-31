import path from 'node:path'

/** True only for a strict descendant, using path components rather than string prefixes. */
export function isWithin(parent: string, target: string) {
  const relative = path.relative(parent, target)
  return (
    relative !== '' &&
    relative !== '..' &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  )
}
