#let glyphweave-pdf(
  body,
  fonts: (
    "PingFang SC",
    "Hiragino Sans GB",
    "Heiti SC",
    "Songti SC",
  ),
  mono-fonts: ("Menlo",),
  lang: "zh",
  region: "CN",
) = {
  set page(
    paper: "a4",
    margin: (x: 2.4cm, y: 2.2cm),
    numbering: "1",
  )
  set text(
    font: fonts,
    lang: lang,
    region: region,
    size: 10.5pt,
    fill: rgb("#1f2933"),
  )
  set par(
    justify: true,
    first-line-indent: 2em,
    leading: 0.78em,
  )
  set list(indent: 1.4em, body-indent: 0.5em)
  set enum(indent: 1.4em, body-indent: 0.5em)
  set terms(indent: 1.4em)

  show heading: set text(weight: "semibold", fill: rgb("#18242f"))
  show heading: set par(first-line-indent: 0pt, justify: false)
  show raw: set text(font: mono-fonts, size: 0.92em)
  show link: set text(fill: rgb("#245b74"))
  show figure.caption: set text(size: 0.9em, fill: rgb("#65737e"))
  show table.cell: set text(size: 0.92em)

  body
}
