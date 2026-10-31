# Astro 集成

Astro 不直接编译 Typst，只读取 Glyphweave 已生成的产物。

构建顺序：

```bash
pnpm glyphweave build
node scripts/sync-glyphweave-public.mjs
pnpm astro build
```

文章页应只注入 `content.html`：

```astro
<article class="glyphweave-content" data-pagefind-body>
  <Fragment set:html={post.contentHtml} />
</article>
```

工作区示例在 Astro 的 `prerender` 环境中将 `glyphweave` 保留为外部 Node 依赖。它按包的位置读取版本、Typst prelude 和原生程序，不能随预渲染代码一起搬进站点输出目录。该设置只作用于静态生成，浏览器脚本和公开资源仍正常打包与导出。

示例站提供：

- 首页文章列表。
- 归档页。
- 标签页。
- 文章详情页。
- PDF 下载链接。
- 右侧目录。
- Pagefind 索引。

生成资源使用 `/glyphweave/posts/<slug>/...` public path。示例站通过 `scripts/sync-glyphweave-public.mjs` 在 Astro build 前复制 PDF 和资源到 `public/glyphweave`。

当前行为及破坏性变更见[配置说明](configuration.md)。

通过 `openGlyphweaveSnapshot(root)` 打开并校验一次产物快照，用 `snapshot.readPost(slug)` 读取正文，用 `exportGlyphweaveAssets(snapshot, destination)` 导出可发布资源。自定义预览宿主可用 `snapshot.copyAssets(selectedSlugs, stagingDirectory)` 复制自己选择的文章。一次站点构建应复用同一个快照，详见[架构说明](architecture.md#统一产物快照)。Astro 加载器使用同一校验入口，重载失败时保留之前的内容存储。
