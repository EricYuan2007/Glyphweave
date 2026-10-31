import { defineConfig } from 'astro/config'

const githubPages = process.env.GITHUB_PAGES === 'true'

export default defineConfig({
  site: 'https://ericyuan2007.github.io',
  base: githubPages ? '/Glyphweave' : '/',
  // Keep the linked Node package's version, prelude and native paths relative to the package.
  vite: {
    environments: {
      prerender: { resolve: { external: ['glyphweave'] } },
    },
  },
})
