import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.test.ts'],
    testTimeout: 20_000,
  },
  resolve: {
    alias: {
      '@glyphweave/core': new URL('./packages/core/src/index.ts', import.meta.url).pathname,
      '@glyphweave/schema': new URL('./packages/schema/src/index.ts', import.meta.url).pathname,
      '@glyphweave/html-adapter': new URL('./packages/html-adapter/src/index.ts', import.meta.url).pathname,
      '@glyphweave/typst': new URL('./packages/typst/src/index.ts', import.meta.url).pathname,
      '@glyphweave/astro': new URL('./packages/astro/src/index.ts', import.meta.url).pathname,
    },
  },
})
