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
      'glyphweave/math': new URL('./packages/glyphweave/src/math/index.ts', import.meta.url)
        .pathname,
      'glyphweave/schema': new URL('./packages/glyphweave/src/schema/index.ts', import.meta.url).pathname,
      'glyphweave/html': new URL('./packages/glyphweave/src/html/index.ts', import.meta.url)
        .pathname,
      'glyphweave/compiler': new URL('./packages/glyphweave/src/compiler/index.ts', import.meta.url).pathname,
      'glyphweave/artifacts': new URL('./packages/glyphweave/src/artifacts/index.ts', import.meta.url).pathname,
      'glyphweave': new URL('./packages/glyphweave/src/build/index.ts', import.meta.url).pathname,
    },
  },
})
