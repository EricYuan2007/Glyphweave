#let glyphweave-pdf(
  body,
  fonts: (
    "Songti SC",
    "Noto Serif CJK SC",
    "STSong",
    "PingFang SC",
  ),
  heading-fonts: (
    "PingFang SC",
    "Noto Sans CJK SC",
    "Heiti SC",
    "STHeiti",
  ),
  heading-weight: 600,
  latin-fonts: ("Libertinus Serif",),
  font-size: 10.5pt,
  mono-fonts: ("Menlo", "DejaVu Sans Mono"),
  lang: "zh",
  region: "CN",
) = context {
  let ink = rgb("#262624")
  let muted = rgb("#6c6b67")
  let rule = rgb("#d8d7d2")
  let accent = rgb("#245b74")
  let heading-size = 13.5pt
  let list-spacing = 0.95em
  let list-markers = (
    text(font: heading-fonts, size: 1em, weight: heading-weight)[•],
    text(font: heading-fonts, size: 0.82em, weight: heading-weight)[•],
  )

  // Keep CJK punctuation in the CJK face while giving Latin real italic/bold faces.
  let body-fonts = latin-fonts.map(name => (name: name, covers: "latin-in-cjk")) + fonts
  // Calibrate natural text frames instead of assuming every font has a 1em frame.
  // Tall equations may still enlarge individual lines; do not clip them to a grid.
  let leading-for(ratio, size: font-size, font: body-fonts) = {
    let sample = text(font: font, size: size, weight: 400)[中文Agpq]
    let single = measure(sample)
    let pair = measure({
      set par(leading: 0pt)
      [#sample#linebreak()#sample]
    })
    calc.max(0pt, ratio * size - (pair.height - single.height))
  }

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
    font: body-fonts,
    weight: 400,
    tracking: 0pt,
    cjk-latin-spacing: auto,
    lang: lang,
    region: region,
    size: font-size,
    fill: ink,
  )
  let line-leading = leading-for(1.6)
  let block-spacing = line-leading + 0.15em
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
  set list(
    marker: list-markers,
    indent: 1.3em,
    body-indent: 0.38em,
    spacing: list-spacing,
  )
  set enum(indent: 1.3em, body-indent: 0.45em, spacing: list-spacing)
  set terms(indent: 1.3em, spacing: list-spacing)
  set heading(numbering: "1.1")

  // Text remains text: no global ASCII boxes or baseline rules inside mathematics.
  show math.equation: set text(font: "New Computer Modern Math")
  show emph: it => {
    // CJK families often have no italic face. Preserve emphasis without fake slant.
    show regex("[\\p{Han}]+"): set text(style: "normal", weight: 700)
    it
  }

  let heading-content(it) = context {
    if it.level > 1 {
      let levels = counter(heading).get()
      numbering("1.1", ..levels.slice(1))
      h(0.5em)
    }
    it.body
  }

  // One heading rhythm across levels, expressed in pt rather than inherited em.
  show heading: set block(above: 18pt, below: 12pt, sticky: true)
  show heading: it => {
    set text(font: heading-fonts, size: heading-size, weight: heading-weight, fill: ink)
    set par(first-line-indent: 0pt, justify: false, leading: 0.5em)
    block(breakable: false)[#heading-content(it)]
  }

  // Separate code through whitespace, monospace and line numbers, like a printed listing.
  show raw.where(block: true): it => block(
    width: 100%,
    above: 1.1em,
    below: 1.1em,
    inset: (x: 0pt, y: 6pt),
    fill: none,
    stroke: none,
    breakable: true,
  )[
    #set text(font: mono-fonts + fonts, size: 8.5pt, fill: ink)
    #set par(first-line-indent: 0pt, justify: false, leading: leading-for(1.45, size: 8.5pt, font: mono-fonts + fonts), spacing: 0pt)
    #show raw.line: line => grid(
      columns: (2.15em, 1fr),
      column-gutter: 1em,
      align(right, text(font: mono-fonts, size: 7.5pt, fill: muted)[#line.number]),
      line.body,
    )
    #it
  ]
  // Keep native break opportunities in commands and paths. A box makes all of a
  // raw span indivisible, stretching the preceding justified Chinese line.
  show raw.where(block: false): set text(font: mono-fonts + fonts, size: 0.88em)

  // Keep display spacing on the native equation block, without nested wrappers.
  show math.equation.where(block: true): set block(
    above: 1em,
    below: 1em,
    breakable: false,
  )
  // Multiline equation rows have their own rhythm, independent of CJK body leading.
  show math.equation.where(block: true): set par(leading: 0.5em)

  set table(
    inset: (x: 8pt, y: 5.5pt),
    align: left + horizon,
    stroke: (x, y) => if y == 0 {
      (bottom: 0.8pt + ink)
    } else {
      (top: 0.35pt + rule)
    },
  )
  show table: it => block(width: 100%, above: 0.85em, below: 0.85em)[#it]
  show table.cell: set text(size: 9pt)
  show table.cell: set par(first-line-indent: 0pt, justify: false, leading: leading-for(1.5, size: 9pt), spacing: 0pt)
  show table.cell.where(y: 0): set text(font: heading-fonts, weight: 500)

  show figure.where(kind: table): set block(breakable: true)
  show figure: it => block(
    width: 100%,
    above: 0.75em,
    below: 0.75em,
    breakable: it.kind == table,
  )[#align(center, it)]
  show figure.caption: set text(size: 8.5pt, fill: muted)
  show figure.caption: set par(first-line-indent: 0pt, justify: false, leading: leading-for(1.5, size: 8.5pt))

  show quote.where(block: true): set par(first-line-indent: (amount: 2em, all: true), leading: line-leading)
  show footnote.entry: set text(size: 8.5pt, fill: muted)
  show footnote.entry: set par(first-line-indent: 0pt, leading: leading-for(1.5, size: 8.5pt))
  show bibliography: set text(size: 9pt)
  show bibliography: set par(leading: leading-for(1.5, size: 9pt), spacing: 0.5em)
  show link: set text(fill: accent)

  body
}
