import { defineConfig } from '@glyphweave/core'

const pagesBase = process.env.GITHUB_PAGES === 'true' ? '/Glyphweave' : ''

export default defineConfig({
  content: {
    root: 'content/typst-posts',
  },
  output: {
    root: '.glyphweave',
    publicBasePath: `${pagesBase}/glyphweave`,
  },
  typst: {
    pdf: {
      failure: 'warn',
    },
  },
})
