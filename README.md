# Glyphweave

[![CI](https://github.com/EricYuan2007/Glyphweave/actions/workflows/ci.yml/badge.svg)](https://github.com/EricYuan2007/Glyphweave/actions/workflows/ci.yml)
[![Pages](https://github.com/EricYuan2007/Glyphweave/actions/workflows/pages.yml/badge.svg)](https://github.com/EricYuan2007/Glyphweave/actions/workflows/pages.yml)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6)
![pnpm](https://img.shields.io/badge/pnpm-11.x-f69220)
![Typst](https://img.shields.io/badge/Typst-0.14.x-239dad)
![License](https://img.shields.io/badge/license-MIT-green)

Glyphweave is a build-time publishing pipeline for turning Typst posts into web-native blog artifacts: sanitized HTML fragments, table-of-contents JSON, manifests, a content index, copied assets, and optional PDF downloads.

> Glyphweave is an independent project and is not affiliated with or endorsed by Typst GmbH. Typst is used as the underlying document compiler.

中文文档: [README.zh-CN.md](./README.zh-CN.md)

## Why Glyphweave

Markdown and MDX are excellent for ordinary prose, but many technical posts need stronger typesetting, formulas, diagrams, and a matching PDF artifact. Glyphweave lets `.typ` documents act as first-class blog content without embedding a PDF viewer as the main reading experience.

The Phase 1 pipeline is:

```text
.typ + post.yaml
  -> Typst HTML export
  -> Glyphweave HTML Adapter
  -> content.html / toc.json / manifest.json
  -> Astro or another static site generator
```

Optional PDF output follows the same Typst source:

```text
.typ -> typst compile -> article.pdf
```

## Features

- Discover Typst posts from `content/typst-posts/*/post.yaml`.
- Validate metadata with Zod.
- Compile HTML and optional PDF through the Typst CLI.
- Sanitize raw Typst HTML before it reaches `set:html`.
- Generate stable heading IDs and `toc.json`.
- Reject local absolute paths and unsafe URL protocols.
- Rewrite article-local assets into public deployment paths.
- Inject a Glyphweave HTML prelude and render complex equations through Typst `html.frame` SVG.
- Keep conservative MathML recovery as a fallback for simple ignored inline equations.
- Emit math capture statistics and Typst HTML diagnostics in each manifest.
- Emit per-post `manifest.json` and a site-level `.glyphweave/content-index.json`.
- Provide an Astro example with homepage, archive, tag pages, post pages, PDF links, and Pagefind indexing.

## Requirements

- Node.js 22 or newer.
- pnpm 11.1.1 or newer.
- Typst CLI 0.14.x for real Typst compilation.

Install Typst on macOS:

```bash
brew install typst
typst --version
```

## Quick Start

```bash
pnpm install
pnpm glyphweave doctor
pnpm glyphweave build
pnpm --filter example-astro-blog build
pnpm --filter example-astro-blog pagefind
```

Preview the example site:

```bash
pnpm --filter example-astro-blog exec astro preview --host 127.0.0.1 --port 4321
```

Open:

```text
http://127.0.0.1:4321/posts/hnsw-search-notes/
```

## Content Model

Each post lives in its own directory:

```text
content/
  typst-posts/
    hnsw-search-notes/
      index.typ
      post.yaml
      assets/
        hnsw-layer.svg
```

Minimal `post.yaml`:

```yaml
title: "HNSW Search Notes"
slug: "hnsw-search-notes"
description: "Technical notes about HNSW graph search."
date: "2026-05-28"
tags:
  - HNSW
  - Retrieval
status: "published"
visibility: "public"
pdf: true
source: "index.typ"
```

## Configuration

Create `glyphweave.config.ts`:

```ts
import { defineConfig } from '@glyphweave/core'

export default defineConfig({
  content: {
    root: 'content/typst-posts',
  },
  output: {
    root: '.glyphweave',
    publicBasePath: '/glyphweave',
  },
  typst: {
    binary: 'typst',
    wrapper: {
      injectPrelude: true,
    },
    pdf: {
      enabledByDefault: false,
      failure: 'warn',
    },
  },
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
})
```

## CLI

```bash
pnpm glyphweave build
pnpm glyphweave clean
pnpm glyphweave inspect hnsw-search-notes
pnpm glyphweave doctor
```

All CLI commands accept `--root <dir>` for operating on a project directory other than the current working directory.

## Generated Artifacts

```text
.glyphweave/
  content-index.json
  generated/
    posts/
      hnsw-search-notes/
        raw.html
        content.html
        toc.json
        manifest.json
        article.pdf
        assets/
  logs/
```

Only `content.html` is intended for HTML injection. `raw.html` is diagnostic output and should not be rendered directly.

## Astro Integration

The example site reads `.glyphweave/content-index.json`, loads `content.html` and `toc.json`, and injects the sanitized HTML inside:

```astro
<article class="glyphweave-content" data-pagefind-body>
  <Fragment set:html={post.contentHtml} />
</article>
```

Generated assets are copied into `public/glyphweave` before `astro build`, so public paths such as `/glyphweave/posts/<slug>/article.pdf` work in the static site.

## Development

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm run verify:demo
```

## Documentation

English:

- [Architecture](./docs/architecture.md)
- [HTML Adapter](./docs/adapter.md)
- [Math Rendering and Capture](./docs/math-rendering.md)
- [Astro Integration](./docs/astro-integration.md)
- [Security](./docs/security.md)
- [Troubleshooting](./docs/troubleshooting.md)
- [Acceptance](./docs/acceptance.md)

Chinese:

- [架构](./docs/zh-CN/architecture.md)
- [使用指南](./docs/zh-CN/usage.md)
- [HTML Adapter](./docs/zh-CN/adapter.md)
- [复杂公式与内容捕获](./docs/zh-CN/math-rendering.md)
- [Astro 集成](./docs/zh-CN/astro-integration.md)
- [安全模型](./docs/zh-CN/security.md)
- [故障排查](./docs/zh-CN/troubleshooting.md)

## License

MIT
