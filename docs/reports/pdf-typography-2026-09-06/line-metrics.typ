#set text(lang: "zh", region: "CN")
#for font in (("Songti SC",), ("PingFang SC",), ("Libertinus Serif", "Songti SC")) {
 for size in (10pt, 10.5pt, 11pt) {
  for lead in (0.65, 0.72, 0.8, 0.905, 0.955) {
   set text(font: font, size: size)
   set par(leading: lead * 1em)
   context {
    let one = measure([中文阅读Abcg])
    let three = measure([中文阅读Abcg#linebreak()中文阅读Abcg#linebreak()中文阅读Abcg])
    metadata((font:font, size_pt:size/1pt, leading_em:lead, pitch_pt:(three.height - one.height)/2/1pt, ratio:(three.height - one.height)/2/size))
   }
  }
 }
}
