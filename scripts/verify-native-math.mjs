import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'

const root = process.cwd()
const study = path.join(root, 'test-results/native-math')
const run = (binary, args) => execFileSync(binary, args, { cwd: root, stdio: 'inherit' })
run('cargo', ['build', '--release', '--locked', '--manifest-path', 'crates/typst-html/Cargo.toml'])
run('pnpm', ['build:packages'])
const binary = path.join(root, 'crates/typst-html/target/release/glyphweave-typst-html')
await rm(study, { recursive: true, force: true })
await mkdir(study, { recursive: true })
const fixture = path.join(root, 'tests/fixtures/native-math')
run(binary, [fixture, path.join(fixture, 'main.typ'), path.join(study, 'raw.html'), '1793145600'])
for (const script of ['preview', 'geometry', 'integration'])
  run(process.execPath, [path.join(root, 'scripts/native-math', `${script}.mjs`)])
run(binary, [
  fixture,
  path.join(fixture, 'stress.typ'),
  path.join(study, 'stress.html'),
  '1793145600',
])
const stress = JSON.parse(await readFile(path.join(study, 'stress.html.layout.json'), 'utf8'))
if (stress.frames.length !== 8 || !stress.frames[0].items.some((i) => i.kind === 'rect'))
  throw new Error('Native overline/macro regression')
const html = await readFile(path.join(study, 'stress.html'), 'utf8')
if (!html.includes('2026') || !html.includes('href="#'))
  throw new Error('Date/reference regression')
await writeFile(
  path.join(study, 'stress-result.json'),
  JSON.stringify(
    { frames: stress.frames.length, overlineRule: true, reference: true, fixedDate: true },
    null,
    2,
  ),
)
console.log(
  'Native compiler, layout, three-engine browser, cache/export/rollback and source regressions passed.',
)

run(process.execPath, ['scripts/verify-math-accessibility.mjs'])
