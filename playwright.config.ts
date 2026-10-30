import { defineConfig, devices } from '@playwright/test'
const port = Number(process.env.GLYPHWEAVE_TEST_PORT ?? 4321)
const baseURL = `http://127.0.0.1:${port}${process.env.GITHUB_PAGES === 'true' ? '/Glyphweave' : ''}/`
export default defineConfig({
  testDir: './tests/browser',
  outputDir: 'dist/test-results/browser',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL, trace: 'retain-on-failure' },
  webServer: {
    command: 'pnpm --filter example-astro-blog exec node scripts/preview.mjs',
    url: baseURL,
    reuseExistingServer: false,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'mobile', use: { ...devices['iPhone 13'] } },
  ],
})
