import path from 'node:path'
import { pathToFileURL } from 'node:url'
/* global URL */
import fs from 'node:fs/promises'
import { renderMathLayout } from '../../packages/glyphweave/dist/math/index.js'
const root = pathToFileURL(path.resolve('test-results/native-math') + path.sep)
const layout = JSON.parse(await fs.readFile(new URL('raw.html.layout.json', root), 'utf8'))
const rendered = renderMathLayout(layout, './math.otf')
await fs.writeFile(new URL('math.otf', root), rendered.font)
await fs.writeFile(new URL('math.css', root), rendered.css)
let html = await fs.readFile(new URL('raw.html', root), 'utf8')
html = html.replace(/<span data-gw-layout="(gw-frame-\d+)"[^>]*><\/span>/g, (_, id) =>
  rendered.frames.get(id),
)
html = html.replace(
  '</head>',
  '<link rel="stylesheet" href="math.css"><style>body{font:20px/1.8 Georgia,"Songti SC",serif;color:#262626;max-width:900px;margin:40px auto;padding:0 24px}h2{font-size:18px;font-weight:400;margin:40px 0 18px;color:#888}[data-gw-math="block"]{text-align:center;overflow-x:auto;padding:20px 0}[data-gw-math="inline"]{display:inline}h1{font-weight:400}</style></head>',
)
html = html.replace(
  '<body>',
  '<body><h1>Typst → HTML · 原生布局</h1><p>Glyphweave 自有后端。可见公式由 HTML、CSS 与字形字体组成。</p>',
)
await fs.writeFile(new URL('gallery.html', root), html)
console.log({
  frames: rendered.frames.size,
  glyphs: layout.glyphs.length,
  fonts: layout.fonts.map((x) => x.family),
  fontBytes: rendered.font.length,
})
