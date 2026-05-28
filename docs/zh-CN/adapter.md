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
9. 在可安全匹配时，把 Typst HTML export 忽略的简单行内公式恢复为 MathML。

## 公式恢复

Typst 0.14.x 可能输出 `equation was ignored during HTML export`。此时 raw HTML 可能把一行拆成多个 `<p>`，并完全省略公式：

```typst
给定查询向量 $q$，算法逐层下降。
```

```html
<p>给定查询向量</p>
<p>，算法逐层下降。</p>
```

Glyphweave 会读取源 `.typ` 文件，把这些拆开的段落匹配回同一行，并恢复为 MathML：

```html
<p>给定查询向量 <math class="gw-math" aria-label="q"><mi>q</mi></math>，算法逐层下降。</p>
```

当前恢复逻辑是保守的，适合简单行内公式、下标和上标。复杂公式后续应依赖更完整的 Typst HTML math 支持或专门的数学渲染器。
