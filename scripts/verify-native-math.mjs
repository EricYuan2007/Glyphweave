import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { readFile, writeFile } from 'node:fs/promises'

const root = process.cwd()
const study = path.join(root, 'research/typst-html-renderer-2026-10-28')
const run = (binary, args) => execFileSync(binary, args, { cwd: root, stdio: 'inherit' })
run('cargo', ['build', '--release', '--locked', '--manifest-path', 'crates/typst-html/Cargo.toml'])
run('pnpm', ['build:packages'])
const binary = path.join(root, 'crates/typst-html/target/release/glyphweave-typst-html')
const fixture = path.join(study, 'fixture')
run(binary, [fixture, path.join(fixture, 'main.typ'), path.join(study, 'raw.html'), '1793145600'])
run('typst', ['compile', '--features', 'html', '--format', 'html', path.join(fixture, 'reference.typ'), path.join(study, 'reference.html')])
for (const script of ['preview', 'check', 'geometry', 'compare', 'integration']) run(process.execPath, [path.join(study, `${script}.mjs`)])
run(binary, [fixture, path.join(fixture, 'stress.typ'), path.join(study, 'stress.html'), '1793145600'])
const stress = JSON.parse(await readFile(path.join(study, 'stress.html.layout.json'), 'utf8'))
if (stress.frames.length !== 8 || !stress.frames[0].items.some(i => i.kind === 'rect')) throw new Error('Native overline/macro regression')
const html = await readFile(path.join(study, 'stress.html'), 'utf8')
if (!html.includes('2026') || !html.includes('href="#')) throw new Error('Date/reference regression')
await writeFile(path.join(study, 'stress-result.json'), JSON.stringify({ frames: stress.frames.length, overlineRule: true, reference: true, fixedDate: true }, null, 2))
console.log('Native compiler, layout, three-engine browser, cache/export/rollback and source regressions passed.')

run(process.execPath, ['scripts/verify-math-accessibility.mjs'])
