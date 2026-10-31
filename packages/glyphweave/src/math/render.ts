import { createHash } from 'node:crypto'
import type { Element, ElementContent, Properties } from 'hast'
import type { MathLayout, SemanticNode } from './layout.js'
import { createMathFont } from './font.js'

const decimal = (n: number) => Number(n.toFixed(8)).toString()
const span = (properties: Properties, children: ElementContent[]): Element => ({
  type: 'element',
  tagName: 'span',
  properties,
  children,
})
function semanticNode(node: SemanticNode): Element {
  return {
    type: 'element',
    tagName: node.tag,
    properties: { ...node.attrs },
    children: node.children.map((child) =>
      typeof child === 'string' ? { type: 'text', value: child } : semanticNode(child),
    ),
  }
}
export interface RenderedMath {
  frames: Map<string, Element>
  css: string
  font: Uint8Array
  digest: string
}

/** Internal rendering consumes a layout already validated at the process boundary. */
export function renderValidatedMath(layout: MathLayout, fontUrl: string): RenderedMath {
  if (!/^\/?[a-zA-Z0-9_./%-]+\.otf$/.test(fontUrl) || fontUrl.split('/').includes('..'))
    throw new Error('Unsafe math font URL')
  const digest = createHash('sha256').update(JSON.stringify(layout)).digest('hex').slice(0, 20)
  const family = `GWMath${digest}`
  const scope = `gw-layout-${digest}`
  const css = [
    `@font-face{font-family:${family};src:url("${fontUrl}") format("opentype");font-weight:400;font-style:normal;font-display:block}`,
    `.${scope}{display:inline-block;position:relative;line-height:0;white-space:nowrap;overflow:visible;isolation:isolate}`,
    `.${scope}>.gw-layout-ink{position:absolute;inset:0;user-select:none}`,
    `.${scope} .gw-layout-glyph{position:absolute;left:0;top:0;display:block;margin:0;padding:0;border:0;font-family:${family}!important;font-weight:400!important;font-style:normal!important;font-synthesis:none;line-height:0!important;letter-spacing:0!important;font-feature-settings:"kern" 0,"liga" 0;white-space:pre;overflow:visible}`,
    `.${scope} .gw-layout-rule{position:absolute;display:block;margin:0;padding:0;border:0}`,
    `.${scope}>.gw-layout-semantics{position:absolute!important;width:1px!important;height:1px!important;margin:0!important;padding:0!important;border:0!important;overflow:hidden!important;clip-path:inset(50%)!important;white-space:nowrap!important;user-select:none!important}`,
    `.${scope}>.gw-layout-source{position:absolute;inset:0;overflow:hidden;color:transparent;forced-color-adjust:none;white-space:pre;line-height:1;user-select:all;cursor:text;z-index:1}`,
    `.${scope}.gw-math-selected{background:Highlight;background:color-mix(in srgb, Highlight 25%, transparent)}`,
    `.${scope}>.gw-layout-source::selection{color:transparent;background:transparent}`,
    `@media(forced-colors:active){.${scope} .gw-layout-glyph{color:CanvasText!important}.${scope} .gw-layout-rule{background:CanvasText!important}}`,
  ]
  const frames = new Map<string, Element>()
  for (const [f, frame] of layout.frames.entries()) {
    const cls = `${scope}-f${f}`
    css.push(
      `.${cls}{width:${decimal(frame.width / frame.em)}em;height:${decimal(frame.height / frame.em)}em;vertical-align:${decimal((frame.baseline - frame.height) / frame.em)}em}`,
    )
    const ink: Element[] = []
    for (const [i, mark] of frame.items.entries()) {
      const own = `${cls}-i${i}`
      if (mark.kind === 'glyph') {
        // Positions are in container em; font-size scales the generated font's 1000-unit glyph.
        // Use a zero-size positioning box so child font-size cannot rescale left/top.
        css.push(
          `.${own}{position:absolute;left:${decimal(mark.x / frame.em)}em;top:${decimal(mark.y / frame.em)}em}`,
        )
        css.push(
          `.${own}>.gw-layout-glyph{font-size:${decimal(mark.size / frame.em)}em;color:${mark.color}}`,
        )
        ink.push(
          span({ className: [own] }, [
            span({ className: ['gw-layout-glyph'] }, [
              { type: 'text', value: String.fromCodePoint(0xe000 + mark.glyph) },
            ]),
          ]),
        )
      } else {
        css.push(
          `.${own}{left:${decimal(mark.x / frame.em)}em;top:${decimal(mark.y / frame.em)}em;width:${decimal(mark.width / frame.em)}em;height:${decimal(mark.height / frame.em)}em;background:${mark.color}}`,
        )
        ink.push(span({ className: ['gw-layout-rule', own] }, []))
      }
    }
    const children: Element[] = [
      span({ className: ['gw-layout-ink'], ariaHidden: 'true', dataPagefindIgnore: true }, ink),
    ]
    if (frame.semantics.source)
      children.push(
        span(
          {
            className: ['gw-layout-source'],
            ariaHidden: 'true',
            dataPagefindIgnore: true,
            dataGwTypstSource: frame.semantics.source,
          },
          [{ type: 'text', value: frame.semantics.source }],
        ),
      )
    const math = semanticNode(frame.semantics.math)
    if (frame.semantics.alt) math.properties.ariaLabel = frame.semantics.alt
    children.push(span({ className: ['gw-layout-semantics'], lang: frame.semantics.lang }, [math]))
    frames.set(frame.id, span({ className: [scope, cls], dataGwAccessibleMath: 'true' }, children))
  }
  return { frames, css: css.join('\n'), font: createMathFont(layout, family), digest }
}
