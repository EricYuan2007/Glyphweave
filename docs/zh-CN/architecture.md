# 架构

Glyphweave Phase 1 是一个构建期管线，用于把 Typst 文章转换成静态站点可以直接消费的 Web 产物。

## 数据流

```text
post.yaml + index.typ
  -> discoverPosts()
  -> compileTypstHtml()
  -> adaptTypstHtml()
  -> content.html + toc.json + manifest.json
  -> content-index.json
  -> Astro 静态页面
```

## 包职责

- `@glyphweave/schema`：配置、文章元数据、manifest、content-index 的 Zod schema。
- `@glyphweave/core`：文章发现、hash、构建编排、产物写入。
- `@glyphweave/typst`：Typst CLI 检测和 HTML/PDF 编译封装。
- `@glyphweave/html-adapter`：正文提取、heading id、TOC、资源/链接重写和安全清洗。
- `@glyphweave/cli`：`build`、`clean`、`inspect`、`doctor` 命令。
- `@glyphweave/astro`：面向 Astro 的轻量读取工具。

## 信任边界

`raw.html` 只用于诊断，不应该直接注入页面。只有经过 Adapter 处理后的 `content.html` 可以被 Astro `set:html` 使用。Adapter 会检查 URL、删除危险节点与属性，并在发现本地绝对路径时失败。

## 输出契约

每篇成功构建的文章会生成：

- `raw.html`：Typst 原始 HTML export。
- `content.html`：可注入页面的安全 HTML fragment。
- `toc.json`：从 `h1` 到 `h4` 提取的目录。
- `manifest.json`：编译器、hash、路径、PDF 和资源信息。
- `article.pdf`：启用 PDF 时的下载产物。

全站入口是 `.glyphweave/content-index.json`。
