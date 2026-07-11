import { describe, expect, it } from 'vitest'
import {
  buildTocTree,
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

  it('builds nested table-of-contents branches from heading depths', () => {
    expect(
      buildTocTree([
        { id: 'intro', title: 'Introduction', depth: 2 },
        { id: 'implementation', title: 'Implementation', depth: 2 },
        { id: 'loss', title: 'Loss function', depth: 3 },
        { id: 'details', title: 'Details', depth: 4 },
        { id: 'conclusion', title: 'Conclusion', depth: 2 },
      ]),
    ).toEqual([
      { id: 'intro', title: 'Introduction', depth: 2, children: [] },
      {
        id: 'implementation',
        title: 'Implementation',
        depth: 2,
        children: [
          {
            id: 'loss',
            title: 'Loss function',
            depth: 3,
            children: [
              { id: 'details', title: 'Details', depth: 4, children: [] },
            ],
          },
        ],
      },
      { id: 'conclusion', title: 'Conclusion', depth: 2, children: [] },
    ])
  })
})
