#import "prelude.typ": glyphweave-html
#show: glyphweave-html.with(semantics: true)
#set text(lang: "zh")
#let half(body) = math.frac(body, [2])
#math.equation(half($a+b$), alt: "a 加 b 的和除以二")
$ root(3, x) + x_1^2 $
$ mat(1, 2; 3, 4) $
$ cases(1 "若" x>0, 0 "否则") $
#set math.equation(numbering: "(1)")
$ a = 1 $ <first>
$ b = 2 $ <second>
@first @second
