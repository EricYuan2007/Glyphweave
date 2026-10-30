import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import { readFileSync } from 'node:fs'

// TypeScript and Vitest resolve workspace source through the same map.
const { compilerOptions } = JSON.parse(
  readFileSync(new URL('../../tsconfig.json', import.meta.url), 'utf8'),
)
export default defineConfig({
  test: {
    globals: true,
    include: ['tests/**/*.test.ts'],
    testTimeout: 20_000,
  },
  resolve: {
    alias: Object.fromEntries(
      Object.entries(compilerOptions.paths as Record<string, string[]>)
        .sort(([a], [b]) => b.length - a.length)
        .map(([name, [source]]) => [
          name,
          fileURLToPath(new URL('../../' + source, import.meta.url)),
        ]),
    ),
  },
})
