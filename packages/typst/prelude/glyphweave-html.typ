#let glyphweave-html(body, semantics: false) = {
  // Keep mathematical symbols and CJK conditions in complementary serif faces.
  show math.equation: set text(font: ("New Computer Modern Math", "Noto Serif CJK SC", "Songti SC", "STSong"))
  show math.equation: it => context {
    if target() == "html" {
      show: if it.block { it => it } else { box }
      let kind = if it.block { "block" } else { "inline" }
      let tag = if it.block { "div" } else { "span" }
      html.elem(tag, attrs: ("data-gw-math": kind, "data-gw-source": repr(it.body)), {
        html.frame(it)
        if semantics {
          // The same evaluated equation preserves macros, labels and counters.
          let attrs = ("data-gw-semantic": "true", "lang": text.lang)
          if it.alt != none { attrs.insert("aria-label", it.alt) }
          html.elem("span", attrs: attrs, it)
        }
      })
    } else {
      it
    }
  }

  body
}
