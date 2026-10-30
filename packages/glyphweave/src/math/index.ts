import { createHash } from 'node:crypto'
import opentype from 'opentype.js'
import { z } from 'zod'

const number = z.number().finite().min(-1e7).max(1e7)
const positive = number.refine((n) => n > 0)
const color = z.string().regex(/^#[0-9a-f]{6}([0-9a-f]{2})?$/i)
const command = z.discriminatedUnion('op', [
  z.object({ op: z.literal('M'), x: number, y: number }).strict(),
  z.object({ op: z.literal('L'), x: number, y: number }).strict(),
  z.object({ op: z.literal('Q'), x1: number, y1: number, x: number, y: number }).strict(),
  z
    .object({
      op: z.literal('C'),
      x1: number,
      y1: number,
      x2: number,
      y2: number,
      x: number,
      y: number,
    })
    .strict(),
  z.object({ op: z.literal('Z') }).strict(),
])
const item = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('glyph'),
      glyph: z.number().int().nonnegative(),
      x: number,
      y: number,
      size: positive,
      color,
    })
    .strict(),
  z
    .object({
      kind: z.literal('rect'),
      x: number,
      y: number,
      width: number.nonnegative(),
      height: number.nonnegative(),
      color,
    })
    .strict(),
])
export interface SemanticNode {
  tag: string
  attrs: Record<string, string>
  children: (SemanticNode | string)[]
}
const mathTags = new Set(
  'math mi mn mo ms mtext mrow mfrac msqrt mroot mstyle merror mpadded mphantom mfenced menclose msub msup msubsup munder mover munderover mmultiscripts mprescripts none mtable mtr mtd maligngroup malignmark mspace'.split(
    ' ',
  ),
)
const mathAttrs = new Set(
  'display mathvariant stretchy fence separator accent accentunder columnalign rowalign columnspan rowspan displaystyle scriptlevel largeop movablelimits form linethickness notation'.split(
    ' ',
  ),
)
function safeSemantic(value: unknown): value is SemanticNode {
  let count = 0
  function check(v: unknown, depth: number): boolean {
    if (++count > 10000 || depth > 64) return false
    if (typeof v === 'string') return v.length <= 10000
    if (!v || typeof v !== 'object' || Array.isArray(v)) return false
    const n = v as SemanticNode
    return (
      Object.keys(n).every((k) => ['tag', 'attrs', 'children'].includes(k)) &&
      mathTags.has(n.tag) &&
      !!n.attrs &&
      typeof n.attrs === 'object' &&
      !Array.isArray(n.attrs) &&
      Object.entries(n.attrs).every(
        ([k, v]) => mathAttrs.has(k) && typeof v === 'string' && v.length <= 1000,
      ) &&
      Array.isArray(n.children) &&
      n.children.every((c) => check(c, depth + 1))
    )
  }
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as SemanticNode).tag === 'math' &&
    check(value, 0)
  )
}
const semantics = z
  .object({
    source: z.string().max(100000).nullable().optional(),
    math: z.custom<SemanticNode>(safeSemantic, 'Invalid or unsafe mathematical semantics'),
    alt: z.string().max(10000).nullable(),
    lang: z.string().regex(/^[a-zA-Z]{2,8}(-[a-zA-Z0-9]{1,8})*$/),
  })
  .strict()
function semanticHtml(node: SemanticNode): string {
  return `<${node.tag}${Object.entries(node.attrs)
    .map(([k, v]) => ` ${k}="${escape(v)}"`)
    .join(
      '',
    )}>${node.children.map((c) => (typeof c === 'string' ? escape(c) : semanticHtml(c))).join('')}</${node.tag}>`
}
/** Coordinates are Typst points. Glyph outlines use a 1000-unit, Y-up font grid. */
export const LayoutSchema = z
  .object({
    version: z.literal(2),
    compiler: z.literal('typst-0.15.1'),
    glyphs: z
      .array(
        z.object({ key: z.string().max(300), commands: z.array(command).max(100000) }).strict(),
      )
      .max(6000),
    frames: z
      .array(
        z
          .object({
            id: z.string().regex(/^gw-frame-[0-9]+$/),
            width: number.nonnegative(),
            height: number.nonnegative(),
            baseline: number,
            em: positive,
            text: z.string().max(100000),
            semantics,
            items: z.array(item).max(100000),
          })
          .strict(),
      )
      .max(10000),
    fonts: z.array(z.object({ family: z.string(), license: z.string() }).strict()).max(500),
  })
  .strict()
export type MathLayout = z.infer<typeof LayoutSchema>

const escape = (s: string) =>
  s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
const decimal = (n: number) => Number(n.toFixed(8)).toString()

export interface RenderedMath {
  frames: Map<string, string>
  css: string
  font: Uint8Array
  digest: string
}

/** Render only validated native layout. No parsing of formula source or browser math layout. */
export function renderMathLayout(input: unknown, fontUrl: string): RenderedMath {
  const layout = LayoutSchema.parse(input)
  if (!/^\/?[a-zA-Z0-9_./%-]+\.otf$/.test(fontUrl) || fontUrl.split('/').includes('..'))
    throw new Error('Unsafe math font URL')
  const digest = createHash('sha256').update(JSON.stringify(layout)).digest('hex').slice(0, 20)
  const family = `GWMath${digest}`
  const glyphs = [
    new opentype.Glyph({ name: '.notdef', advanceWidth: 1000, path: new opentype.Path() }),
  ]
  for (const [index, glyph] of layout.glyphs.entries()) {
    const path = new opentype.Path()
    for (const c of glyph.commands) {
      switch (c.op) {
        case 'M':
          path.moveTo(c.x, c.y)
          break
        case 'L':
          path.lineTo(c.x, c.y)
          break
        case 'Q':
          path.quadraticCurveTo(c.x1, c.y1, c.x, c.y)
          break
        case 'C':
          path.curveTo(c.x1, c.y1, c.x2, c.y2, c.x, c.y)
          break
        case 'Z':
          path.close()
          break
      }
    }
    glyphs.push(
      new opentype.Glyph({ name: `g${index}`, unicode: 0xe000 + index, advanceWidth: 1000, path }),
    )
  }
  // Symmetric nonzero ascent/descent prevents CoreText's zero-descent fallback to
  // the CFF bounding box. With line-height:0 the baseline coincides with the positioning origin.
  let extent = 1000
  for (const glyph of layout.glyphs)
    for (const command of glyph.commands)
      for (const [key, value] of Object.entries(command)) {
        if (key.startsWith('y')) extent = Math.max(extent, Math.ceil(Math.abs(Number(value))))
      }
  if (extent > 32760) throw new Error('Glyph exceeds OpenType metric range')
  const font = new opentype.Font({
    familyName: family,
    styleName: 'Regular',
    unitsPerEm: 1000,
    ascender: extent,
    descender: -extent,
    glyphs,
    copyright: layout.fonts.map((f) => `${f.family}\n${f.license}`).join('\n\n'),
  })
  font.tables.os2.sTypoAscender = extent
  font.tables.os2.sTypoDescender = -extent
  font.tables.os2.sTypoLineGap = 0
  font.tables.os2.usWinAscent = extent
  font.tables.os2.usWinDescent = extent
  font.tables.os2.fsSelection = 0x40 | 0x80
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
  const frames = new Map<string, string>()
  for (const [f, frame] of layout.frames.entries()) {
    if (frames.has(frame.id)) throw new Error(`Duplicate math frame: ${frame.id}`)
    const cls = `${scope}-f${f}`
    css.push(
      `.${cls}{width:${decimal(frame.width / frame.em)}em;height:${decimal(frame.height / frame.em)}em;vertical-align:${decimal((frame.baseline - frame.height) / frame.em)}em}`,
    )
    let ink = ''
    for (const [i, mark] of frame.items.entries()) {
      const own = `${cls}-i${i}`
      if (mark.kind === 'glyph') {
        if (!layout.glyphs[mark.glyph]) throw new Error(`Missing glyph ${mark.glyph}`)
        // Positions are in container em; font-size scales the generated font's 1000-unit glyph.
        // Use a zero-size positioning box so child font-size cannot rescale left/top.
        css.push(
          `.${own}{position:absolute;left:${decimal(mark.x / frame.em)}em;top:${decimal(mark.y / frame.em)}em}`,
        )
        css.push(
          `.${own}>.gw-layout-glyph{font-size:${decimal(mark.size / frame.em)}em;color:${mark.color}}`,
        )
        ink += `<span class="${own}"><span class="gw-layout-glyph">${String.fromCodePoint(0xe000 + mark.glyph)}</span></span>`
      } else {
        css.push(
          `.${own}{left:${decimal(mark.x / frame.em)}em;top:${decimal(mark.y / frame.em)}em;width:${decimal(mark.width / frame.em)}em;height:${decimal(mark.height / frame.em)}em;background:${mark.color}}`,
        )
        ink += `<span class="gw-layout-rule ${own}"></span>`
      }
    }
    frames.set(
      frame.id,
      `<span class="${scope} ${cls}" data-gw-accessible-math="true"><span class="gw-layout-ink" aria-hidden="true" data-pagefind-ignore>${ink}</span>${frame.semantics.source ? `<span class="gw-layout-source" aria-hidden="true" data-pagefind-ignore data-gw-typst-source="${escape(frame.semantics.source)}">${escape(frame.semantics.source)}</span>` : ''}<span class="gw-layout-semantics" lang="${escape(frame.semantics.lang)}">${semanticHtml({ ...frame.semantics.math, attrs: { ...frame.semantics.math.attrs, ...(frame.semantics.alt ? { 'aria-label': frame.semantics.alt } : {}) } })}</span></span>`,
    )
  }
  return { frames, css: css.join('\n'), font: stableFontBytes(font.toArrayBuffer()), digest }
}

/** OpenType.js writes wall-clock head timestamps. Normalize and repair SFNT checksums. */
function stableFontBytes(buffer: ArrayBuffer) {
  const view = new DataView(buffer)
  let head = -1,
    record = -1,
    length = 0
  for (let i = 0; i < view.getUint16(4); i++) {
    const offset = 12 + i * 16
    if (view.getUint32(offset) === 0x68656164) {
      record = offset
      head = view.getUint32(offset + 8)
      length = view.getUint32(offset + 12)
      break
    }
  }
  if (head < 0 || length < 54 || head + length > buffer.byteLength)
    throw new Error('Invalid generated font head')
  view.setUint32(head + 8, 0)
  for (const offset of [20, 28]) {
    view.setUint32(head + offset, 0)
    view.setUint32(head + offset + 4, 2082844800)
  }
  const sum = (start: number, end: number) => {
    let result = 0
    for (let offset = start; offset < end; offset += 4) {
      let word = 0
      for (let byte = 0; byte < 4; byte++)
        word = (word << 8) | (offset + byte < end ? view.getUint8(offset + byte) : 0)
      result = (result + (word >>> 0)) >>> 0
    }
    return result
  }
  view.setUint32(record + 4, sum(head, head + length))
  view.setUint32(head + 8, (0xb1b0afba - sum(0, buffer.byteLength)) >>> 0)
  return new Uint8Array(buffer)
}
