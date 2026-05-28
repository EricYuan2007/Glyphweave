import { defineConfig } from '@glyphweave/core'

export default defineConfig({
  content: {
    root: 'content/typst-posts',
  },
  output: {
    root: '.glyphweave',
    publicBasePath: '/glyphweave',
  },
  typst: {
    pdf: {
      failure: 'warn',
    },
  },
})
