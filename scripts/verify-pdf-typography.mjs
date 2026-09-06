import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile, copyFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { execa } from 'execa'
import { compileTypstPdf } from '../packages/typst/dist/index.js'
import { PdfTemplateSchema } from '../packages/schema/dist/index.js'

// Real paged rendering tests live in integration, not in the compiler-free unit suite.
const root = await mkdtemp(path.join(os.tmpdir(), 'glyphweave-pdf-test-'))
try {
  const fonts = (await execa('typst', ['fonts'])).stdout
  const portable = fonts.split('\n').includes('Noto Serif CJK SC')
  assert(
    portable || fonts.split('\n').includes('Songti SC'),
    'Install Noto CJK fonts for PDF tests',
  )
  const config = PdfTemplateSchema.parse(
    portable ? { profile: 'portable' } : { fonts: ['Songti SC'], headingFonts: ['PingFang SC'] },
  )
  const source = path.join(root, 'source.typ')
  const fixture = await readFile('tests/fixtures/pdf/typography.typ', 'utf8')
  await writeFile(source, fixture)
  await copyFile('packages/typst/prelude/glyphweave-pdf.typ', path.join(root, 'prelude.typ'))
  const tuple = (values) =>
    `(${values.map((v) => JSON.stringify(v)).join(',')}${values.length ? ',' : ''})`
  const args = `fonts: ${tuple(config.fonts)}, heading-fonts: ${tuple(config.headingFonts)}, mono-fonts: ${tuple(config.monoFonts)}`
  for (const size of [10.5, 11]) {
    await writeFile(
      path.join(root, 'query.typ'),
      `#import "prelude.typ": glyphweave-pdf\n#show: glyphweave-pdf.with(${args}, font-size: ${size}pt)\n#include "source.typ"`,
    )
    const query = await execa('typst', [
      'query',
      '--root',
      root,
      path.join(root, 'query.typ'),
      'metadata',
      '--field',
      'value',
    ])
    const [metrics] = JSON.parse(query.stdout)
    assert.equal(metrics.size, size)
    assert(
      Math.abs(metrics.equationRowGap - size * 0.5) < 0.02,
      'Multiline math rows should not inherit CJK paragraph leading',
    )
    for (const gap of metrics.headingGaps) {
      assert(Math.abs(gap - 12) < 0.02, 'Heading-to-body spacing is too tight or inconsistent')
    }
    assert(
      Math.abs(metrics.equationGap - size) < 0.02,
      'Adjacent display equations should have one body em of clear block spacing',
    )
    assert(Math.abs(metrics.pitch - size * 1.6) < 0.02, JSON.stringify(metrics))
    assert(
      Math.abs(metrics.mixed - metrics.spaced) < 0.01,
      'CJK-Latin spacing differs with manual spaces',
    )
    assert(Math.abs(metrics.boundary - size * 0.5) < 0.01, 'Lost automatic CJK-Latin boundaries')
    assert(metrics.wrapped < metrics.unbreakable, 'Text is no longer naturally hyphenatable')
    await writeFile(
      path.join(root, 'native.typ'),
      `#set text(size: ${size}pt)\n#context metadata(measure($a+b=c$).width / 1pt)`,
    )
    const native = await execa('typst', [
      'query',
      path.join(root, 'native.typ'),
      'metadata',
      '--field',
      'value',
    ])
    assert(
      Math.abs(metrics.equation - JSON.parse(native.stdout)[0]) < 0.01,
      'Template changes mathematical glyphs or spacing',
    )
  }
  const pdf = path.join(root, 'article.pdf')
  const output = await compileTypstPdf({
    binary: 'typst',
    cwd: root,
    inputPath: source,
    outputPath: pdf,
    wrapper: { pdfTemplate: config },
  })
  assert.equal(output.preludeVersion, 'glyphweave-pdf-2')
  const text = (await execa('pdftotext', ['-layout', pdf, '-'])).stdout
  const pages = text.split('\f').filter((s) => s.trim())
  assert(pages.length >= 2 && pages.length <= 5, 'Long table should span a few normal pages')
  assert(pages.filter((s) => s.includes('中文表头')).length >= 2, 'Table header did not repeat')
  for (let i = 0; i < 80; i++)
    assert(new RegExp(`ROW-${i}(?![0-9])`).test(text), `Missing table row ${i}`)
  assert(
    text.replace(/\s/g, '').includes('packages/typst/prelude/glyphweave-pdf.typ'),
    'Wrapped path text changed',
  )
  const embedded = (await execa('pdffonts', [pdf])).stdout
  assert(/LibertinusSerif.*Italic/i.test(embedded), 'Missing real Latin italic face')
  assert(/NewCM.*Math/i.test(embedded), 'Missing math face')
  if (portable) {
    assert(/NotoSerifCJK/i.test(embedded))
    assert(/NotoSansCJK/i.test(embedded))
  }
  // The lower-level API with no wrapper options must retain template defaults.
  await compileTypstPdf({
    binary: 'typst',
    cwd: root,
    inputPath: source,
    outputPath: path.join(root, 'default.pdf'),
  })
  if (portable) {
    await assert.rejects(
      compileTypstPdf({
        binary: 'typst',
        cwd: root,
        inputPath: source,
        outputPath: path.join(root, 'missing.pdf'),
        wrapper: { pdfTemplate: { profile: 'portable', fonts: ['Missing Glyphweave CJK'] } },
      }),
      /Portable PDF profile requires/,
    )
  }
  console.log(
    `PDF typography: CJK gaps, natural math, hyphenation, calibrated line heights, heading/display/row spacing, paths, table pagination and fonts passed (${config.profile})`,
  )
} finally {
  await rm(root, { recursive: true, force: true })
}
