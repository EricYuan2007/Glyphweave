= HNSW 检索算法笔记

HNSW 是一种基于多层图结构的近似最近邻搜索算法。这段文字用于验证 Pagefind 和静态页面能索引 Typst 正文。

== 分层图结构

在高层图中，节点更稀疏，搜索过程更接近全局导航。

#image("assets/layer.svg", width: 60%)

== 搜索过程

给定查询向量 $q$，算法从入口点开始逐层下降。

简单行内公式也会保留在同一段落里，例如 $a+b=c$、$x_1$、$n^2$，以及 $alpha+beta=gamma$。

复杂行内公式通过 Typst frame 转成 SVG，例如候选集合的平方权重 $sum_(i=1)^n x_i^2$。

块级公式会保留为可横向滚动的 SVG 区块：

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

更多资料可以访问 https://typst.app。
