import { describe, expect, it } from 'vitest'
import { sitePath, withoutSiteBase } from '../examples/astro-blog/src/lib/site-path.js'

describe('site paths', () => {
  it('prefixes internal routes for a GitHub project site', () => {
    expect(sitePath('/', '/Glyphweave/')).toBe('/Glyphweave/')
    expect(sitePath('/posts/demo', '/Glyphweave/')).toBe('/Glyphweave/posts/demo')
    expect(sitePath('/tags/typst', '/')).toBe('/tags/typst')
  })

  it('removes the deployment base before matching navigation routes', () => {
    expect(withoutSiteBase('/Glyphweave/posts/demo', '/Glyphweave/')).toBe('/posts/demo')
    expect(withoutSiteBase('/', '/')).toBe('/')
  })
})
