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
  let ink = rgb("#282828")
  let muted = rgb("#6f6d68")
  let rule = rgb("#d9d7d1")
  let soft = rgb("#f4f3ef")

  set page(
    paper: "a4",
    margin: (top: 2.45cm, bottom: 2.25cm, left: 2.55cm, right: 2.35cm),
    header: context {
      set text(font: fonts, size: 7.5pt, fill: muted)
      if counter(page).get().first() > 1 [
        #text(tracking: 0.12em)[GLYPHWEAVE]
        #h(1fr)
        TYPST EDITION
      ]
    },
    footer: context {
      set text(font: fonts, size: 8pt, fill: muted)
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
    first-line-indent: 2em,
    leading: 0.76em,
    spacing: 0.82em,
  )
  set list(indent: 1.45em, body-indent: 0.55em, spacing: 0.38em)
  set enum(indent: 1.45em, body-indent: 0.55em, spacing: 0.38em)
  set terms(indent: 1.45em, spacing: 0.42em)

  show heading.where(level: 1): it => {
    set text(size: 25pt, weight: "semibold", fill: ink)
    set par(first-line-indent: 0pt, justify: false, leading: 0.58em)
    block(above: 0.35em, below: 1.2em, breakable: false)[#it.body]
  }
  show heading.where(level: 2): it => {
    set text(size: 16pt, weight: "semibold", fill: ink)
    set par(first-line-indent: 0pt, justify: false)
    block(above: 1.7em, below: 0.68em, breakable: false)[#it.body]
  }
  show heading.where(level: 3): it => {
    set text(size: 12.5pt, weight: "semibold", fill: ink)
    set par(first-line-indent: 0pt, justify: false)
    block(above: 1.35em, below: 0.5em, breakable: false)[#it.body]
  }
  show heading.where(level: 4): set text(size: 11pt, weight: "semibold", fill: ink)
  show heading.where(level: 4): set par(first-line-indent: 0pt, justify: false)

  show raw.where(block: true): it => block(
    width: 100%,
    above: 1.15em,
    below: 1.15em,
    inset: (x: 11pt, y: 9pt),
    fill: soft,
    stroke: (left: 1pt + muted),
    radius: 2pt,
    breakable: true,
  )[
    #set text(font: mono-fonts, size: 8.4pt, fill: ink)
    #set par(first-line-indent: 0pt, justify: false, leading: 0.55em)
    #it
  ]
  show raw.where(block: false): set text(font: mono-fonts, size: 0.88em)

  show math.equation.where(block: true): it => block(
    above: 1.2em,
    below: 1.2em,
    breakable: false,
  )[#it]

  show table: it => block(above: 1.15em, below: 1.15em)[#it]
  show table.cell: set text(size: 9pt)
  show table.cell: set par(first-line-indent: 0pt, justify: false, leading: 0.56em)

  show figure: it => block(above: 1.25em, below: 1.25em)[#it]
  show figure.caption: set text(size: 8.5pt, fill: muted)
  show figure.caption: set par(first-line-indent: 0pt, justify: false)
  show link: set text(fill: rgb("#245b74"))

  body
}
