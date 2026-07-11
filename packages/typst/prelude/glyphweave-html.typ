#let glyphweave-html(body) = {
  show math.equation: it => context {
    if target() == "html" {
      show: if it.block { it => it } else { box }
      let kind = if it.block { "block" } else { "inline" }
      let tag = if it.block { "div" } else { "span" }
      html.elem(tag, attrs: ("data-gw-math": kind), html.frame(it))
    } else {
      it
    }
  }

  body
}
