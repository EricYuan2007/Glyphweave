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
