import { readFile } from 'node:fs/promises'
import { toHtml } from 'hast-util-to-html'
import rehypeParse from 'rehype-parse'
import { unified } from 'unified'
import { scanSourceFormulasFromText } from '@glyphweave/typst'
import { rewriteAssets } from './assets.js'
import { createCaptureDiagnostics, createCaptureReport } from './capture.js'
import { extractToc, normalizeHeadingIds } from './headings.js'
import { normalizeNativeMathml, normalizeTypstFrameMath } from './math.js'
import {
  assertNoLocalAbsolutePaths,
  assertNoUnsafeProtocols,
  rewriteLinks,
  sanitize,
} from './security.js'
import { extractBody } from './tree.js'
import type { HastNode, HtmlAdapterInput, HtmlAdapterOutput } from './types.js'

export async function adaptTypstHtml(input: HtmlAdapterInput): Promise<HtmlAdapterOutput> {
  const raw = await readFile(input.rawHtmlPath, 'utf-8')
  assertNoLocalAbsolutePaths(raw)

  const root = unified().use(rehypeParse, { fragment: false }).parse(raw) as HastNode
  const body = extractBody(root)
  const source = await readFile(input.post.sourcePath, 'utf-8')
  const sourceFormulas = scanSourceFormulasFromText(source, input.post.sourcePath)
  const nativeMathml = normalizeNativeMathml(body)
  const mathFrameCapture = normalizeTypstFrameMath(body, sourceFormulas, input.math)
  normalizeHeadingIds(body, input.options.headingIds)
  const toc = extractToc(body)
  const rewrittenAssets = await rewriteAssets(body, input)
  rewriteLinks(body)
  if (input.options.sanitize) sanitize(body)

  const diagnostics = [
    ...(input.diagnostics ?? []),
    ...createCaptureDiagnostics(sourceFormulas, nativeMathml + mathFrameCapture.typstFrameSvg),
  ]
  const capture = createCaptureReport(body, {
    sourceFormulaCount: sourceFormulas.length,
    nativeMathml,
    typstFrameSvg: mathFrameCapture.typstFrameSvg,
    sourceFallbacks: mathFrameCapture.sourceFallbacks,
    diagnostics,
  })
  const contentHtml = toHtml({ type: 'root', children: body.children ?? [] } as any)
  assertNoLocalAbsolutePaths(contentHtml)
  assertNoUnsafeProtocols(contentHtml)

  return {
    contentHtml,
    toc,
    rewrittenAssets,
    warnings: diagnostics
      .filter((diagnostic) => diagnostic.severity !== 'info')
      .map((diagnostic) => diagnostic.message),
    capture,
    diagnostics,
  }
}
