import { describe, expect, it } from 'vitest'
import {
  positionSidenotes,
  selectActiveHeading,
} from '../examples/astro-blog/src/lib/article-layout.js'

describe('article layout helpers', () => {
  it('selects the latest heading that crossed the activation line', () => {
    expect(
      selectActiveHeading(
        [
          { id: 'intro', top: -240 },
          { id: 'details', top: 96 },
          { id: 'summary', top: 430 },
        ],
        120,
      ),
    ).toBe('details')
  })

  it('keeps sidenotes aligned to references while preventing collisions', () => {
    expect(
      positionSidenotes(
        [
          { anchorTop: 100, height: 80 },
          { anchorTop: 140, height: 50 },
          { anchorTop: 310, height: 60 },
        ],
        16,
      ),
    ).toEqual([100, 196, 310])
  })
})
