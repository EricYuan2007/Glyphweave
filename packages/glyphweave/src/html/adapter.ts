import { prepareNativeMath } from './native-math.js'
import type { Root } from 'hast'
import { readFile } from 'node:fs/promises'
import { toHtml } from 'hast-util-to-html'
import rehypeParse from 'rehype-parse'
import { unified } from 'unified'
import { scanSourceFormulasFromText } from '../compiler/index.js'
import { rewriteAssets } from './assets.js'
import { createCaptureDiagnostics, createCaptureReport } from './capture.js'
import { highlightCodeBlocks } from './code.js'
import { extractToc, normalizeHeadingIds } from './headings.js'
import { normalizeNativeMathml, normalizeTypstFrameMath } from './math.js'
import { rewriteLinks, sanitize } from './security.js'
import { extractBody } from './tree.js'
import { normalizeQuoteAttributions } from './typography.js'
import type { HastNode, HtmlAdapterInput, HtmlAdapterOutput } from './types.js'

export async function adaptTypstHtml(input: HtmlAdapterInput): Promise<HtmlAdapterOutput> {
  const raw = await readFile(input.rawHtmlPath, 'utf-8')

  const root = unified().use(rehypeParse, { fragment: false }).parse(raw) as HastNode
  const body = extractBody(root)
  const source = await readFile(input.post.sourcePath, 'utf-8')
  const sourceFormulas = scanSourceFormulasFromText(source, input.post.sourcePath)
  const native = await prepareNativeMath(body, input)
  const nativeMathml = normalizeNativeMathml(body)
  const mathFrameCapture = normalizeTypstFrameMath(body, sourceFormulas, input.math)
  const rewrittenAssets = await rewriteAssets(body, input)
  if (native) rewrittenAssets.push(...native.assets)
  rewriteLinks(body)
  sanitize(body)
  normalizeHeadingIds(body, input.options.headingIds)
  const toc = extractToc(body)
  normalizeQuoteAttributions(body)
  await highlightCodeBlocks(body)
  native?.apply(body)

  const diagnostics = [
    ...(input.diagnostics ?? []),
    ...createCaptureDiagnostics(
      sourceFormulas,
      nativeMathml + mathFrameCapture.typstFrameSvg + (native?.count ?? 0),
    ),
  ]
  const capture = createCaptureReport(body, {
    sourceFormulaCount: sourceFormulas.length,
    nativeMathml,
    typstFrameSvg: mathFrameCapture.typstFrameSvg,
    typstFrameHtml: native?.count ?? 0,
    sourceFallbacks: mathFrameCapture.sourceFallbacks,
    diagnostics,
  })
  // Code highlighting is a trusted transform: only fixed Shiki colors and owned controls.
  const stylesheet = native
    ? toHtml({
        type: 'element',
        tagName: 'link',
        properties: { rel: ['stylesheet'], href: native.stylesheet },
        children: [],
      })
    : ''
  const contentHtml = stylesheet + toHtml({ type: 'root', children: body.children ?? [] } as Root)

  return {
    contentHtml: `<div class="${input.options.scopeClass}">${contentHtml}</div>`,
    toc,
    rewrittenAssets,
    warnings: diagnostics
      .filter((diagnostic) => diagnostic.severity !== 'info')
      .map((diagnostic) => diagnostic.message),
    capture,
    diagnostics,
  }
}
