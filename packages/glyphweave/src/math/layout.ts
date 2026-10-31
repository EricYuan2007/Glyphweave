import { z } from 'zod'

const number = z.number().finite().min(-1e7).max(1e7)
const positive = number.refine((n) => n > 0)
const color = z.string().regex(/^#[0-9a-f]{6}([0-9a-f]{2})?$/i)
const command = z.discriminatedUnion('op', [
  z.strictObject({ op: z.literal('M'), x: number, y: number }),
  z.strictObject({ op: z.literal('L'), x: number, y: number }),
  z.strictObject({ op: z.literal('Q'), x1: number, y1: number, x: number, y: number }),
  z.strictObject({
    op: z.literal('C'),
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    x: number,
    y: number,
  }),
  z.strictObject({ op: z.literal('Z') }),
])
const item = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('glyph'),
    glyph: z.number().int().nonnegative(),
    x: number,
    y: number,
    size: positive,
    color,
  }),
  z.strictObject({
    kind: z.literal('rect'),
    x: number,
    y: number,
    width: number.nonnegative(),
    height: number.nonnegative(),
    color,
  }),
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
const semantics = z.strictObject({
  source: z.string().max(100000).nullable().optional(),
  math: z.custom<SemanticNode>(safeSemantic, 'Invalid or unsafe mathematical semantics'),
  alt: z.string().max(10000).nullable(),
  lang: z.string().regex(/^[a-zA-Z]{2,8}(-[a-zA-Z0-9]{1,8})*$/),
})
/** Coordinates are Typst points. Glyph outlines use a 1000-unit, Y-up font grid. */
export const LayoutSchema = z
  .strictObject({
    version: z.literal(2),
    compiler: z.literal('typst-0.15.1'),
    glyphs: z
      .array(z.strictObject({ key: z.string().max(300), commands: z.array(command).max(100000) }))
      .max(6000),
    frames: z
      .array(
        z.strictObject({
          id: z.string().regex(/^gw-frame-[0-9]+$/),
          width: number.nonnegative(),
          height: number.nonnegative(),
          baseline: number,
          em: positive,
          text: z.string().max(100000),
          semantics,
          items: z.array(item).max(100000),
        }),
      )
      .max(10000),
    fonts: z.array(z.strictObject({ family: z.string(), license: z.string() })).max(500),
  })
  .superRefine((layout, context) => {
    const ids = new Set<string>()
    for (const frame of layout.frames) {
      if (ids.has(frame.id))
        context.addIssue({ code: 'custom', message: `Duplicate math frame: ${frame.id}` })
      ids.add(frame.id)
      for (const item of frame.items) {
        if (item.kind === 'glyph' && !layout.glyphs[item.glyph])
          context.addIssue({ code: 'custom', message: `Missing glyph ${item.glyph}` })
      }
    }
  })
  .brand<'ValidatedMathLayout'>()
export type MathLayout = z.infer<typeof LayoutSchema>
