# Glyphweave

[![CI](https://github.com/EricYuan2007/Glyphweave/actions/workflows/ci.yml/badge.svg)](https://github.com/EricYuan2007/Glyphweave/actions/workflows/ci.yml)
[![Pages](https://github.com/EricYuan2007/Glyphweave/actions/workflows/pages.yml/badge.svg)](https://github.com/EricYuan2007/Glyphweave/actions/workflows/pages.yml)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6)
![pnpm](https://img.shields.io/badge/pnpm-11.x-f69220)
![Typst](https://img.shields.io/badge/Typst-0.14.x-239dad)
![License](https://img.shields.io/badge/license-MIT-green)

Glyphweave 是一个构建期发布管线，用于把 Typst 文章转换成 Web 原生产物：安全清洗后的 HTML 正文片段、目录 JSON、manifest、内容索引、静态资源以及可选 PDF 下载文件。

> Glyphweave 是独立项目，不隶属于 Typst GmbH，也不代表 Typst 官方背书。Typst 只是底层文档编译器。

English documentation: [README.md](./README.md)

## 项目目标

很多技术文章需要公式、图表、排版结构和 PDF 归档。Glyphweave 让 `.typ` 文档可以成为博客系统的一等内容源，而不是把 PDF iframe 当作正文。

Phase 1 主链路：

```text
.typ + post.yaml
  -> Typst HTML export
  -> Glyphweave HTML Adapter
  -> content.html / toc.json / manifest.json
  -> Astro 或其他静态站点框架
```

PDF 是补充链路：

```text
.typ -> typst compile -> article.pdf
```

## 功能

- 从 `content/typst-posts/*/post.yaml` 扫描文章。
- 使用 Zod 校验文章元数据。
- 调用 Typst CLI 编译 HTML 和可选 PDF。
- 在进入 Astro `set:html` 前清洗 raw HTML。
- 生成稳定 heading id 和 `toc.json`。
- 拒绝本地绝对路径与危险 URL 协议。
- 复制文章目录内资源并重写为 public path。
- 注入 Glyphweave HTML prelude，用 `html.frame` 将复杂公式渲染为安全 SVG。
- 保留简单公式的 MathML 恢复作为保守 fallback。
- 在 manifest 中输出公式捕获统计和 Typst HTML 诊断。
- 输出每篇文章的 `manifest.json` 和全站 `.glyphweave/content-index.json`。
- 提供 Astro 示例：首页、归档页、标签页、文章页、PDF 下载和 Pagefind 索引。

## 环境要求

- Node.js 22 或更高版本。
- pnpm 11.1.1 或更高版本。
- Typst CLI 0.14.x。

macOS 安装 Typst：

```bash
brew install typst
typst --version
```

## 快速开始

```bash
pnpm install
pnpm glyphweave doctor
pnpm glyphweave build
pnpm --filter example-astro-blog build
pnpm --filter example-astro-blog pagefind
```

预览示例站：

```bash
pnpm --filter example-astro-blog exec astro preview --host 127.0.0.1 --port 4321
```

打开：

```text
http://127.0.0.1:4321/posts/hnsw-search-notes/
```

## 内容结构

每篇文章一个目录：

```text
content/
  typst-posts/
    hnsw-search-notes/
      index.typ
      post.yaml
      assets/
        hnsw-layer.svg
```

最小 `post.yaml`：

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

## 常用命令

```bash
pnpm glyphweave build
pnpm glyphweave clean
pnpm glyphweave inspect hnsw-search-notes
pnpm glyphweave doctor
```

所有 CLI 命令都支持 `--root <dir>`，可以在当前工作目录之外指定项目根目录。

## 复杂公式

默认配置使用 `math.strategy: "hybrid"`。构建 HTML 时，Glyphweave 会为 Typst 注入一个 HTML prelude，把 `math.equation` 通过 `html.frame` 输出为 SVG；HTML Adapter 会把这些 SVG 包装成 `.gw-math` 结构，保留源公式 fallback，并在 `manifest.json` 写入 capture report。

可配置项：

```ts
export default defineConfig({
  math: {
    strategy: 'hybrid',
    failOnIgnoredEquation: true,
    includeSourceFallback: true,
    inlineVerticalShift: '0.08em',
  },
  capture: {
    strict: true,
    report: true,
  },
  typst: {
    wrapper: {
      injectPrelude: true,
    },
  },
})
```

## 文档

- [架构](./docs/zh-CN/architecture.md)
- [使用指南](./docs/zh-CN/usage.md)
- [HTML Adapter](./docs/zh-CN/adapter.md)
- [复杂公式与内容捕获](./docs/zh-CN/math-rendering.md)
- [Astro 集成](./docs/zh-CN/astro-integration.md)
- [安全模型](./docs/zh-CN/security.md)
- [故障排查](./docs/zh-CN/troubleshooting.md)

## 许可证

MIT
