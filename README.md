# Glyphweave

Glyphweave turns Typst posts into web-native blog artifacts: sanitized HTML fragments, TOC JSON, manifests, and optional PDF downloads.

Glyphweave is an independent project and is not affiliated with or endorsed by Typst GmbH.
Typst is used as the underlying document compiler.

## Quick Start

```bash
pnpm install
pnpm glyphweave build
pnpm --filter example-astro-blog build
pnpm --filter example-astro-blog pagefind
```

The root demo content lives in `content/typst-posts`. The Astro example has its own demo content under `examples/astro-blog/content/typst-posts`.

## Commands

- `pnpm glyphweave build`: compile Typst posts into `.glyphweave` artifacts.
- `pnpm glyphweave clean`: remove `.glyphweave`.
- `pnpm glyphweave inspect <slug>`: print metadata, artifact paths, and TOC for a built post.
- `pnpm glyphweave doctor`: check Node, Typst, config, and output directory access.

## Safety Model

Only generated `content.html` is intended for HTML injection. Raw Typst HTML is stored for diagnostics and must not be passed to `set:html`. The adapter removes scripts, event attributes, unsafe URL protocols, and local absolute paths.
