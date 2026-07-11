# HTML Adapter

HTML Adapter 是 Typst raw HTML 和博客运行时之间的安全边界。

它会执行以下步骤：

1. 解析 raw HTML。
2. 从完整 HTML document 中提取 `<body>` children。
3. 为 heading 生成稳定 id。
4. 从 `h1` 到 `h4` 提取 `toc.json`。
5. 复制文章内资源并重写 public path。
6. 为外部链接添加 `rel="noopener noreferrer"`。
7. 删除危险标签和属性。
8. 拒绝本地绝对路径和危险 URL 协议。
9. 将 Typst 0.15 MathML 和 Glyphweave 标记的 SVG 公式归一化为稳定结构。

## 公式归一化

Typst 0.15 会把公式导出为原生 MathML。Adapter 保留完整 MathML 树，并为每个公式添加稳定的 renderer 标记；通过 `display="block"` 判断行间公式，其余公式保持行内。可选 SVG 模式使用 Glyphweave 自有的 `data-gw-math` 属性，不依赖 Typst 内部 SVG class。详见 [复杂公式与内容捕获](./math-rendering.md)。
