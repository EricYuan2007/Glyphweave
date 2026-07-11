#let glyphweave-pdf(
  body,
  fonts: (
    "Songti SC",
    "STSong",
    "PingFang SC",
  ),
  heading-fonts: (
    "PingFang SC",
    "Heiti SC",
    "STHeiti",
  ),
  mono-fonts: ("Menlo",),
  lang: "zh",
  region: "CN",
) = {
  let ink = rgb("#262624")
  let muted = rgb("#6c6b67")
  let rule = rgb("#d8d7d2")
  let soft = rgb("#f7f7f4")
  let accent = rgb("#245b74")
  let heading-size = 13.5pt
  let line-leading = 0.8em
  let block-spacing = 1em
  let heading-spacing = 1.05em

  set page(
    paper: "a4",
    margin: (top: 1.6cm, bottom: 1.35cm, left: 2.45cm, right: 2.35cm),
    header: context {
      set text(font: fonts, size: 7.2pt, fill: muted)
      if counter(page).get().first() > 1 [
        #text(tracking: 0.1em)[GLYPHWEAVE]
        #h(1fr)
        TYPST EDITION
      ]
    },
    footer: context {
      set text(font: fonts, size: 7.5pt, fill: muted)
      align(center, counter(page).display("1"))
    },
  )

  set text(
    font: fonts,
    lang: lang,
    region: region,
    size: 10pt,
    fill: ink,
  )
  set par(
    justify: true,
    first-line-indent: (amount: 2em, all: true),
    leading: line-leading,
    spacing: block-spacing,
    justification-limits: (
      spacing: (min: 85%, max: 120%),
      tracking: (min: -0.01em, max: 0.01em),
    ),
  )
  set list(indent: 1.55em, body-indent: 0.55em, spacing: line-leading)
  set enum(indent: 1.55em, body-indent: 0.55em, spacing: line-leading)
  set terms(indent: 1.55em, spacing: line-leading)
  set heading(numbering: "1.1")

  show regex("[A-Za-z0-9]+"): it => box(move(dy: 0.04em, it))

  let heading-content(it) = context {
    if it.level > 1 {
      let levels = counter(heading).get()
      numbering("1.1", ..levels.slice(1))
      h(0.5em)
    }
    it.body
  }

  show heading: it => {
    set text(font: heading-fonts, size: heading-size, weight: "semibold", fill: ink)
    set par(first-line-indent: 0pt, justify: false, leading: 0.5em)
    block(above: heading-spacing, below: heading-spacing, breakable: false, sticky: true)[#heading-content(it)]
  }

  show raw.where(block: true): it => block(
    width: 100%,
    above: 1.1em,
    below: 1.1em,
    inset: (x: 9pt, y: 6pt),
    fill: soft,
    stroke: (left: 0.6pt + rule),
    breakable: true,
  )[
    #set text(font: mono-fonts, size: 7.6pt, fill: ink)
    #set par(first-line-indent: 0pt, justify: false, leading: 0.38em, spacing: 0pt)
    #show raw.line: line => grid(
      columns: (2.15em, 1fr),
      column-gutter: 0.75em,
      align(right, text(font: mono-fonts, size: 6.8pt, fill: muted)[#line.number]),
      line.body,
    )
    #it
  ]
  show raw.where(block: false): set text(font: mono-fonts, size: 0.86em)

  show math.equation.where(block: true): it => block(
    width: 100%,
    above: 0.45em,
    below: 0.45em,
    breakable: false,
  )[#align(center, it)]

  set table(
    inset: (x: 6pt, y: 5.5pt),
    align: left + horizon,
    stroke: (x, y) => if y == 0 {
      (bottom: 0.8pt + ink)
    } else {
      (top: 0.35pt + rule)
    },
  )
  show table: it => block(width: 100%, above: 0.85em, below: 0.85em)[#it]
  show table.cell: set text(size: 8.4pt)
  show table.cell: set par(first-line-indent: 0pt, justify: false, leading: line-leading, spacing: 0pt)
  show table.cell.where(y: 0): set text(weight: "semibold")

  show figure: it => block(
    width: 100%,
    above: 0.75em,
    below: 0.75em,
    breakable: false,
  )[#align(center, it)]
  show figure.caption: set text(size: 7.8pt, fill: muted)
  show figure.caption: set par(first-line-indent: 0pt, justify: false, leading: 0.4em)

  show quote.where(block: true): set par(first-line-indent: (amount: 2em, all: true), leading: line-leading)
  show footnote.entry: set text(size: 7.7pt, fill: muted)
  show link: set text(fill: accent)

  body
}
