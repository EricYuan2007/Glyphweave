# 使用指南

## 安装

```bash
pnpm install
typst --version
pnpm glyphweave doctor
```

## 创建文章

推荐一篇文章一个目录：

```text
content/
  typst-posts/
    hnsw-search-notes/
      index.typ
      post.yaml
      assets/
        hnsw-layer.svg
```

`post.yaml` 示例：

```yaml
title: "HNSW 检索算法笔记"
slug: "hnsw-search-notes"
description: "一篇关于 HNSW 图搜索的技术笔记。"
date: "2026-05-28"
tags:
  - HNSW
  - Retrieval
status: "published"
visibility: "public"
pdf: true
source: "index.typ"
```

## 构建

```bash
pnpm glyphweave build
```

如果要操作其他目录，可以添加 `--root <dir>`：

```bash
pnpm glyphweave build --root /path/to/site
pnpm glyphweave clean --root /path/to/site
```

默认输出到 `.glyphweave/`：

```text
.glyphweave/
  content-index.json
  generated/posts/<slug>/
    raw.html
    content.html
    toc.json
    manifest.json
    article.pdf
```

## PDF 模板与中文字体

启用 PDF 时，Glyphweave 默认会用内置 Typst 模板包裹原文档，再生成
`article.pdf`。模板会设置 A4 阅读版心、页眉页码、中文语言区域、宋体正文、代码块、
表格、图注和块级公式的独立间距，减少 Typst 默认输出中的字体混杂和版面拥挤。

macOS 默认字体栈：

```ts
export default defineConfig({
  typst: {
    pdf: {
      template: {
        enabled: true,
        fonts: ['Songti SC', 'STSong', 'PingFang SC'],
        monoFonts: ['Menlo'],
        lang: 'zh',
        region: 'CN',
      },
    },
  },
})
```

Linux 或 CI 环境应把 `fonts` 改成实际安装的中文字体，例如
`Noto Serif CJK SC` 或 `Source Han Serif SC`。如果需要完全由文章源码控制
PDF 排版，可以设置 `typst.pdf.template.enabled: false`。

## 示例站

```bash
pnpm --filter example-astro-blog build
pnpm --filter example-astro-blog pagefind
pnpm --filter example-astro-blog exec astro preview --host 127.0.0.1 --port 4321
```

打开：

```text
http://127.0.0.1:4321/posts/hnsw-search-notes/
```

## 常用检查

```bash
pnpm check
pnpm run verify:demo
```
