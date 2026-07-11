import { defineConfig } from 'astro/config'

const githubPages = process.env.GITHUB_PAGES === 'true'

export default defineConfig({
  site: 'https://ericyuan2007.github.io',
  base: githubPages ? '/Glyphweave' : '/',
})
