#let glyphweave-pdf(
  body,
  fonts: (
    "Songti SC",
    "STSong",
    "PingFang SC",
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

  set page(
    paper: "a4",
    margin: (top: 2.25cm, bottom: 2.05cm, left: 2.45cm, right: 2.35cm),
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
    size: 10.5pt,
    fill: ink,
  )
  set par(
    justify: true,
    first-line-indent: (amount: 2em, all: false),
    leading: 0.5em,
    spacing: 0.56em,
    justification-limits: (
      spacing: (min: 85%, max: 120%),
      tracking: (min: -0.01em, max: 0.01em),
    ),
  )
  set list(indent: 1.55em, body-indent: 0.55em, spacing: 0.24em)
  set enum(indent: 1.55em, body-indent: 0.55em, spacing: 0.24em)
  set terms(indent: 1.55em, spacing: 0.28em)

  show heading.where(level: 1): it => {
    set text(size: 21.5pt, weight: "semibold", fill: ink)
    set par(first-line-indent: 0pt, justify: false, leading: 0.48em)
    block(above: 0.2em, below: 0.9em, breakable: false, sticky: true)[#it.body]
  }
  show heading.where(level: 2): it => {
    set text(size: 14.5pt, weight: "semibold", fill: ink)
    set par(first-line-indent: 0pt, justify: false, leading: 0.46em)
    block(above: 1.35em, below: 0.5em, breakable: false, sticky: true)[#it.body]
  }
  show heading.where(level: 3): it => {
    set text(size: 11.8pt, weight: "semibold", fill: ink)
    set par(first-line-indent: 0pt, justify: false, leading: 0.44em)
    block(above: 1.05em, below: 0.38em, breakable: false, sticky: true)[#it.body]
  }
  show heading.where(level: 4): it => {
    set text(size: 10.7pt, weight: "semibold", fill: ink)
    set par(first-line-indent: 0pt, justify: false)
    block(above: 0.9em, below: 0.3em, breakable: false, sticky: true)[#it.body]
  }

  show raw.where(block: true): it => block(
    width: 100%,
    above: 0.85em,
    below: 0.85em,
    inset: (x: 9pt, y: 7pt),
    fill: soft,
    stroke: (left: 0.6pt + rule),
    breakable: true,
  )[
    #set text(font: mono-fonts, size: 8pt, fill: ink)
    #set par(first-line-indent: 0pt, justify: false, leading: 0.42em, spacing: 0pt)
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
    above: 0.85em,
    below: 0.85em,
    breakable: false,
  )[#align(center, it)]

  set table(
    inset: (x: 6pt, y: 4.5pt),
    align: left + horizon,
    stroke: (x, y) => if y == 0 {
      (bottom: 0.8pt + ink)
    } else {
      (top: 0.35pt + rule)
    },
  )
  show table: it => block(width: 100%, above: 0.85em, below: 0.85em)[#it]
  show table.cell: set text(size: 8.8pt)
  show table.cell: set par(first-line-indent: 0pt, justify: false, leading: 0.4em, spacing: 0pt)
  show table.cell.where(y: 0): set text(weight: "semibold")

  show figure: it => block(
    width: 100%,
    above: 0.9em,
    below: 0.9em,
    breakable: false,
  )[#align(center, it)]
  show figure.caption: set text(size: 8.2pt, fill: muted)
  show figure.caption: set par(first-line-indent: 0pt, justify: false, leading: 0.4em)

  show quote.where(block: true): set par(first-line-indent: 0pt, leading: 0.48em)
  show footnote.entry: set text(size: 8pt, fill: muted)
  show link: set text(fill: accent)

  body
}
