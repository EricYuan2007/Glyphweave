= HNSW 检索算法笔记

HNSW 是一种基于多层图结构的近似最近邻搜索算法。这篇文章由 Typst 编译成 HTML 后进入 Astro 博客页面。

== 分层图结构

在高层图中，节点更稀疏，搜索过程更接近全局导航。

#image("assets/hnsw-layer.svg", width: 70%)

== 搜索过程

给定查询向量 $q$，算法从入口点开始逐层下降，并在每一层维护候选集合。

== Web 输出

Glyphweave 输出正文 HTML、目录 JSON、manifest 和可选 PDF，Astro 只消费这些产物。
