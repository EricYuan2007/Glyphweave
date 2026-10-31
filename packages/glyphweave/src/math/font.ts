import opentype from 'opentype.js'
import type { MathLayout } from './layout.js'

export function createMathFont(layout: MathLayout, family: string) {
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
  return stableFontBytes(font.toArrayBuffer())
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
