import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

describe('Pages workflow', () => {
  it('installs CJK fonts and validates the generated PDF before deployment', async () => {
    const workflow = await readFile('.github/workflows/pages.yml', 'utf-8')

    expect(workflow).toContain('fonts-noto-cjk')
    expect(workflow).toContain('poppler-utils')
    expect(workflow).toContain('typst fonts')
    expect(workflow).toContain('pdffonts')
    expect(workflow).toContain('article.pdf')
  })
})
