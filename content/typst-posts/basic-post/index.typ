= HNSW 检索算法笔记

HNSW 是一种基于多层图结构的近似最近邻搜索算法。这段文字用于验证 Pagefind 和静态页面能索引 Typst 正文。

== 分层图结构

在高层图中，节点更稀疏，搜索过程更接近全局导航。

#image("assets/layer.svg", width: 60%)

== 搜索过程

给定查询向量 $q$，算法从入口点开始逐层下降。

更多资料可以访问 https://typst.app。
