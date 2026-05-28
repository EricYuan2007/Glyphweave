#let glyphweave-html(body) = {
  show math.equation: it => context {
    if target() == "html" {
      show: if it.block { it => it } else { box }
      html.frame(it)
    } else {
      it
    }
  }

  body
}
