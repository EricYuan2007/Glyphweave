#pagebreak()
= 中文与混排诊断页

中文Glyphweave中文；中文 Glyphweave 中文；中文API中文；中文 API 中文。

中文2026年9月6日；版本v0.15.0；准确率99.9%；范围1–10；全角（API）与半角(API)。

正文 *中文强调 Bold ABC*，_中文斜体 Italic ABC_，行内代码 `glyphweave build` 与公式 $a+b=c$、$x_1$、$n^2$、$alpha+beta=gamma$。

$ integral_0^1 f(x) dif x quad frac(a+b,c+d) quad sum_(i=1)^n x_i^2 $

#block(width: 180pt, stroke: 0.4pt + gray, inset: 4pt)[
中文Glyphweave中文API中文2026中文Glyphweave中文API中文2026中文Glyphweave中文API中文2026。
]

#block(width: 180pt, stroke: 0.4pt + gray, inset: 4pt)[
#set text(lang: "en", hyphenate: true)
Internationalization characterization representation interoperability typography.
]

#block(width: 180pt, stroke: 0.4pt + gray, inset: 4pt)[
较长行内代码 `packages/typst/prelude/glyphweave-pdf.typ` 后面的中文需要保持可读。
]

#context metadata((
  mixed_width_pt: measure([中文ABC中文]).width / 1pt,
  spaced_width_pt: measure([中文 ABC 中文]).width / 1pt,
  separate_width_pt: (measure([中文]).width * 2 + measure([ABC]).width) / 1pt,
  formula_width_pt: measure($a+b=c$).width / 1pt,
)) <audit-metrics>
