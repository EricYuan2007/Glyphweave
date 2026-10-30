#import "prelude.typ": glyphweave-html
#show: glyphweave-html.with(semantics: true)
= 横线和宏
#let sq(x) = $ #x^2 $
$ overline(x+y) = sq(a) + sq(b) $
= 编号与引用
#set math.equation(numbering: "(1)")
$ E = m c^2 $ <energy>
见 @energy。
#set math.equation(numbering: none)
= 行内基线
正文 $x + 1/2$ 正文 $hat(x)$ 正文。
= 自定义中文字号
#text(size: 16pt)[$ f(x) = cases(1 &"满足条件（含标点）：" x > 0, 0 &"其余情况") $]
= 重音与极高括号
$ lr((frac(1, frac(1, frac(1, x))))) + hat(arrow(v)) $
= 文字颜色
$ #text(fill: rgb("#365e54"))[$x^2 + y^2$] = z^2 $
= 日期
#datetime.today().display()
= 大括号和长根式
$ underbrace(a+b+c+d+e, "合计") + sqrt(a^2+b^2+c^2+d^2) $
