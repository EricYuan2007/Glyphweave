#set text(font: ("PingFang SC", "Hiragino Sans GB", "Heiti SC", "Songti SC"))
#let demo_version = "Phase 1.5"

= Typst 博客语法巡检

这篇示例文章用于验证 Glyphweave 对 Typst 主流博客语法的渲染覆盖。它不是单一算法笔记，而是一篇包含段落、列表、图片、表格、代码、公式、脚注和参考文献的综合 demo。当前示例阶段：#demo_version。

== 文本与链接

Typst 的 markup 适合直接写正文：可以使用 *强强调*、_强调_、`inline code`、智能引号 "quoted text"，也可以显示需要转义的字符，例如 \#topic、\$price 和 \@literal。符号简写也适合博客正文，例如 page~rank、范围 1---10，以及省略号 ...

自动链接会把 https://typst.app/docs/reference/syntax/ 识别为链接；也可以用 #link("https://typst.app/docs/reference/model/")[模型文档] 写带文字的链接。强制换行适合地址或诗句：第一行 \
第二行。

标签和引用适合长文导航。后文中的 @fig-layers 和 @tab-coverage 都来自 Typst label/ref 语法。脚注也应保留在正文上下文里#footnote[脚注用于补充来源、术语或不适合打断主线的说明。]。

== 列表、术语与引用

无序列表适合记录要点：

- 内容源仍然是 `.typ` 文件。
- HTML 由 Typst 导出后进入 Glyphweave Adapter。
  - 适配器负责清洗 HTML、重写资源路径、生成 TOC。
  - 复杂公式通过 Typst frame SVG 保留视觉结果。
- Astro 示例只消费生成产物。

有序列表适合表达流程：

+ 编写 Typst 正文。
+ 运行 `pnpm glyphweave build`。
+ 在 Astro 页面中注入 `content.html`。

术语列表适合技术博客里的概念解释：

/ Markup: Typst 的默认写作模式，用来写普通正文和结构化内容。
/ Math: 用 `$...$` 进入的公式模式，可写行内或块级公式。
/ Code: 用 `#` 进入的表达式模式，可调用函数、变量和脚本逻辑。

#quote(block: true, attribution: [Glyphweave demo])[
  一个好的博客 demo 应该像真实文章一样混合文本、图表、公式和引用，而不是只验证最短路径。
]

== 图像、表格与交叉引用

#figure(
  image("assets/layer.svg", width: 70%, alt: "A layered HNSW graph diagram"),
  caption: [HNSW 分层图示，用来验证 SVG 图片、figure 和 caption。],
) <fig-layers>

@fig-layers 应该以图示引用的形式出现在正文里。表格同样可以放进 figure，见 @tab-coverage。

#figure(
  table(
    columns: (auto, auto, auto),
    table.header([Typst 写法], [博客用途], [验证点]),
    [`= Heading`], [章节结构], [生成稳定 heading id 与 TOC],
    [`- item` / `+ item`], [列表], [缩进、行距和嵌套层级],
    [`#figure(...)`], [图片与表格], [caption、资源路径和响应式宽度],
    [`$x^2$`], [数学公式], [行内对齐、块级居中和 SVG fallback],
    [`@label`], [交叉引用], [链接、文本和 sanitizer],
  ),
  caption: [博客内容语法覆盖矩阵。],
) <tab-coverage>

== 代码与原始文本

行内 raw text 适合写命令和 API 名称，比如 `html.frame`、`glyphweave build` 和 `content.html`。

```typ
#let score = 0.93

= Demo Section

Inline math: $sum_(i=1)^n x_i^2$

#figure(
  image("assets/layer.svg", width: 60%),
  caption: [A figure inside a Typst source block.],
)
```

== 搜索过程

这一节保留 HNSW 主题，用来验证技术博客里常见的行内公式、块级公式和引用文献。给定查询向量 $q$，算法从入口点开始逐层下降，并在每一层维护候选集合。HNSW 的图结构可以参考原论文 @malkov2018。

简单行内公式也会保留在同一段落里，例如 $a+b=c$、$x_1$、$n^2$，以及 $alpha+beta=gamma$。

复杂行内公式通过 Typst frame 转成 SVG，例如候选集合的平方权重 $sum_(i=1)^n x_i^2$。

块级公式会保留为可横向滚动且居中的 SVG 区块：

$
integral_0^1 f(x) dif x
$

$
frac(a+b, c+d)
$

$
mat(1, 2; 3, 4)
$

$
cases(x^2, "if " x >= 0, -x, "otherwise")
$

多行对齐公式也应该保持结构：

$
sum_(k=0)^n k
  &= 1 + ... + n \
  &= (n(n+1)) / 2
$

== Web 输出

Glyphweave 输出正文 HTML、目录 JSON、manifest 和可选 PDF，Astro 只消费这些产物。文中的脚注、引用、表格、图片和公式都应该在生成页面中可见、可索引，并且不出现本地绝对路径或危险协议。

== 参考文献

#bibliography("assets/references.bib", title: none)
