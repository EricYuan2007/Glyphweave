export interface HeadingPosition {
  id: string
  top: number
}

export interface SidenoteMeasurement {
  anchorTop: number
  height: number
}

export function selectActiveHeading(headings: HeadingPosition[], activationLine: number) {
  if (headings.length === 0) return null
  let active = headings[0]!.id
  for (const heading of headings) {
    if (heading.top > activationLine) break
    active = heading.id
  }
  return active
}

export function positionSidenotes(notes: SidenoteMeasurement[], gap: number) {
  const positions: number[] = []
  let nextAvailable = 0

  for (const note of notes) {
    const top = Math.max(note.anchorTop, nextAvailable)
    positions.push(top)
    nextAvailable = top + note.height + gap
  }

  return positions
}
