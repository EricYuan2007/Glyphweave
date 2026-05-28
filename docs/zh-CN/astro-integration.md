# Astro 集成

Astro 不直接编译 Typst，只读取 Glyphweave 已生成的产物。

构建顺序：

```bash
pnpm glyphweave build
pnpm astro build
```

文章页应只注入 `content.html`：

```astro
<article class="glyphweave-content" data-pagefind-body>
  <Fragment set:html={post.contentHtml} />
</article>
```

示例站提供：

- 首页文章列表。
- 归档页。
- 标签页。
- 文章详情页。
- PDF 下载链接。
- 右侧目录。
- Pagefind 索引。

生成资源使用 `/glyphweave/posts/<slug>/...` public path。示例站通过 `scripts/sync-glyphweave-public.mjs` 在 Astro build 前复制 PDF 和资源到 `public/glyphweave`。
