import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { LayoutSchema, renderMathLayout } from '../math/index.js'
import { unified } from 'unified'
import rehypeParse from 'rehype-parse'
import type { RewrittenAsset } from '../schema/index.js'
import type { HastNode, HtmlAdapterInput } from './types.js'
import { classList, propertyValue } from './tree.js'

/** Validates compiler-owned placeholders before untrusted HTML is sanitized. */
export async function prepareNativeMath(root: HastNode, input: HtmlAdapterInput) {
  if (input.math?.strategy !== 'html-frame') return undefined
  const layout = LayoutSchema.parse(
    JSON.parse(await readFile(`${input.rawHtmlPath}.layout.json`, 'utf8')),
  )
  const ids = new Set(layout.frames.map((frame) => frame.id))
  if (ids.size !== layout.frames.length) throw new Error('Duplicate native frame ids')
  const seen = new Set<string>()
  function visit(node: HastNode, mathKind?: string) {
    const kind = propertyValue(node, 'data-gw-math') || mathKind
    const id = propertyValue(node, 'data-gw-layout')
    if (id) {
      if (
        node.tagName !== 'span' ||
        !['inline', 'block'].includes(kind ?? '') ||
        !ids.has(id) ||
        seen.has(id)
      )
        throw new Error(`Invalid native math placeholder: ${id}`)
      seen.add(id)
      node.properties = { ...node.properties, className: [`gw-native-placeholder-${id}`] }
    }
    if (propertyValue(node, 'data-gw-math') && ['inline', 'block'].includes(kind ?? '')) {
      node.properties = {
        ...node.properties,
        className: ['gw-math', `gw-math--${kind}`],
        'data-gw-renderer': 'typst-frame-html',
      }
    }
    for (const child of node.children ?? []) visit(child, kind)
  }
  visit(root)
  if (seen.size !== ids.size) throw new Error('Native math sidecar and HTML do not match')
  const result = renderMathLayout(layout, './font.otf')
  const digest = (bytes: string | Uint8Array) =>
    createHash('sha256').update(bytes).digest('hex').slice(0, 20)
  const fontName = `gw-math-${digest(result.font)}.otf`
  const css = result.css.replaceAll('"./font.otf"', `"./${fontName}"`)
  const cssName = `gw-math-${digest(css)}.css`
  const license = JSON.stringify(layout.fonts, null, 2)
  const directory = path.join(input.outputDir, 'assets')
  await mkdir(directory, { recursive: true })
  const assets: RewrittenAsset[] = []
  const publicDirectory = `${input.publicBasePath.replace(/\/$/, '')}/posts/${input.post.metadata.slug}/assets`
  for (const [name, value] of [
    [fontName, result.font],
    [cssName, css],
    [`gw-math-${digest(license)}.licenses.json`, license],
  ] as const) {
    const file = path.join(directory, name)
    await writeFile(file, value)
    assets.push({ source: file, output: file, publicPath: `${publicDirectory}/${name}` })
  }
  return {
    count: layout.frames.length,
    assets,
    stylesheet: `${publicDirectory}/${cssName}`,
    apply(body: HastNode) {
      const inserted = new Set<string>()
      function replace(node: HastNode) {
        for (const child of node.children ?? []) {
          const marker = classList(child).find((cls) => cls.startsWith('gw-native-placeholder-'))
          if (marker) {
            const id = marker.slice('gw-native-placeholder-'.length)
            const html = result.frames.get(id)
            if (!html || inserted.has(id))
              throw new Error('Invalid sanitized native math placeholder')
            inserted.add(id)
            const fragment = unified().use(rehypeParse, { fragment: true }).parse(html) as HastNode
            child.children = fragment.children
            child.properties = { ...child.properties, className: ['gw-native-frame'] }
          } else replace(child)
        }
      }
      replace(body)
      if (inserted.size !== result.frames.size)
        throw new Error('Sanitization removed a native math frame')
    },
  }
}
