= 中文与混排验证

中文API中文；中文 API 中文；中文2026年；全角（API）与半角(API)；“英文引号”与《中文书名》。

正文 *中文强调 Bold ABC* 与 _中文强调 Italic ABC_，数学 $a+b=c$、$x_1$、$n^2$、$alpha+beta=gamma$。

#context {
  let sample = [中文Agpq]
  let one = measure(sample)
  let three = measure([#sample#linebreak()#sample#linebreak()#sample])
  let equation = measure($a+b=c$).width
  let mixed = measure([中文ABC中文]).width
  let spaced = measure([中文 ABC 中文]).width
  let isolated = measure([中文]).width * 2 + measure([ABC]).width
  let word = [Internationalization characterization representation interoperability typography.]
  let wrapped = {
    set text(lang: "en", hyphenate: true)
    set par(first-line-indent: 0pt, justify: false)
    block(width: 130pt, word)
  }
  let unbreakable = {
    set text(lang: "en", hyphenate: true)
    set par(first-line-indent: 0pt, justify: false)
    show regex("[A-Za-z]+"): box
    block(width: 130pt, word)
  }
  let headingGaps = range(1, 5).map(level => {
    let title = heading(level: level)[标题Agpq]
    (measure([#title #sample]).height - measure(title).height - one.height) / 1pt
  })
  let display = $ frac(a+b, c+d) $
  let equationGap = (measure([#display #display]).height - 2 * measure(display).height) / 1pt
  let row = $ a = b $
  let rows = $ a &= b \ c &= d $
  let equationRowGap = (measure(rows).height - 2 * measure(row).height) / 1pt
  metadata((
    equationRowGap: equationRowGap,
    headingGaps: headingGaps,
    equationGap: equationGap,
    size: text.size / 1pt,
    pitch: (three.height - one.height) / 2 / 1pt,
    equation: equation / 1pt,
    mixed: mixed / 1pt,
    spaced: spaced / 1pt,
    boundary: (mixed - isolated) / 1pt,
    wrapped: measure(wrapped).height / 1pt,
    unbreakable: measure(unbreakable).height / 1pt,
  ))
}

#block(width: 180pt, stroke: 0.4pt + gray, inset: 4pt)[
较长行内代码 `packages/typst/prelude/glyphweave-pdf.typ` 后面的中文需要保持可读。
]

#block(width: 180pt, stroke: 0.4pt + gray, inset: 4pt)[
#set text(lang: "en", hyphenate: true)
Internationalization characterization representation interoperability typography.
]

#figure(
  table(
    columns: (auto, 1fr),
    table.header([ROW], [中文表头]),
    ..range(80).map(i => ([ROW-#i], [中文数据 #i])).flatten(),
  ),
  caption: [长表跨页与重复表头],
)
