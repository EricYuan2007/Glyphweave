# 使用指南

## 安装

```bash
pnpm install
pnpm build
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
title: 'HNSW 检索算法笔记'
slug: 'hnsw-search-notes'
description: '一篇关于 HNSW 图搜索的技术笔记。'
date: '2026-05-28'
tags:
  - HNSW
  - Retrieval
status: 'published'
visibility: 'public'
pdf: true
source: 'index.typ'
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
  generations/<id>/generated/posts/<slug>/
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

默认阅读配置：

```ts
export default defineConfig({
  typst: {
    pdf: {
      template: {
        enabled: true,
        profile: 'editorial',
        fontSize: 10.5,
        lang: 'zh',
        region: 'CN',
      },
    },
  },
})
```

默认 `editorial` 配置以宋体正文、Libertinus Serif 英文和苹方标题为优先选择。
`portable` 配置默认使用 Noto Serif CJK SC / Noto Sans CJK SC / DejaVu Sans Mono；
请先安装 Noto CJK 字体。该配置遇到未安装的配置字体会让 PDF 编译失败，仍服从
`typst.pdf.failure` 的整站失败或警告策略。Pages 示例已选择 portable。

| 配置 | 含义 |
| --- | --- |
| `profile` | `editorial`（默认）或 `portable`；提供字体默认值、标题字重与缺失字体策略 |
| `fontSize` | 正文 pt 字号，8–14，默认 10.5；普通行高按字体测量校准为约 1.6 倍 |
| `fonts` | 中文/后备正文栈，非空；旧配置仍可继续使用 |
| `latinFonts` | 拉丁正文栈，默认 `['Libertinus Serif']`；`[]` 表示使用正文栈的拉丁字形 |
| `headingFonts` | 标题及表头字体栈，非空 |
| `monoFonts` | 代码等宽字体栈，非空 |

字体职责分开后，中文标点保留中文字体，英文支持真实粗体和斜体；中文强调用加粗正体。
标题维持 13.5pt 与原有编号，各级统一上方 18pt、下方 12pt 留白。
独立公式块上下各 1em，相邻间距合并；多行公式内部 leading 为 0.5em。
代码块、图注、脚注使用 8.5pt，表格正文与参考文献使用 9pt。
代码块不设底色和边框，以等宽字体、灰色行号和留白区分区域，保留语法高亮。
复杂行内公式仍允许撑高行框，避免碰撞。路径和命令使用原生断行，复制文本不添加软连字符。

本机缺少字体栈中的某个后备字体会产生 `typst-font-missing` 警告，并写入 manifest。
它不一定意味着缺字：用 `typst fonts --variants` 检查实际字体，显式指定已安装的角色字体可减少警告。
固定排版的构建应固定字体文件版本；profile 本身不下载字体，也不保证各机器字体版本相同。
如果需要完全由文章源码控制 PDF 排版，可以设置 `typst.pdf.template.enabled: false`。

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

升级前请阅读[迁移说明](migration.md)，产物路径必须从索引读取。
