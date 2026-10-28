import { readFile } from 'node:fs/promises'
import { expect, it } from 'vitest'

it('tests the native compiler release in the CI reference renderer', async () => {
  const cargo = await readFile('crates/typst-html/Cargo.toml', 'utf8')
  const action = await readFile('.github/actions/setup-typst/action.yml', 'utf8')
  const version = cargo.match(/^typst = "=([^"]+)"/m)?.[1]
  expect(version).toBeTruthy()
  expect(action).toContain(`/releases/download/v${version}/`)
  expect(action).toContain('sha256sum --check')
})
