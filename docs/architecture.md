# Architecture

Glyphweave Phase 1 is a build-time pipeline:

1. Discover `content/typst-posts/*/post.yaml`.
2. Validate metadata with Zod.
3. Compile `index.typ` to `raw.html` through Typst CLI.
4. Adapt raw HTML into a safe blog fragment.
5. Write `content.html`, `toc.json`, `manifest.json`, optional `article.pdf`, and `.glyphweave/content-index.json`.
6. Let Astro or another SSG consume the generated artifacts.

The package boundaries are intentionally narrow:

- `@glyphweave/schema`: config, metadata, manifest, and content-index schemas.
- `@glyphweave/core`: discovery, hashing, build orchestration, artifact writing.
- `@glyphweave/typst`: Typst CLI detection and compile wrappers.
- `@glyphweave/html-adapter`: body extraction, heading IDs, TOC, resource/link rewriting, and sanitization.
- `@glyphweave/cli`: local commands.
- `@glyphweave/astro`: small Astro-facing helpers.

## Data Flow

```text
post.yaml + index.typ
  -> discoverPosts()
  -> compileTypstHtml()
  -> adaptTypstHtml()
  -> content.html + toc.json + manifest.json
  -> content-index.json
  -> Astro static pages
```

`@glyphweave/core` coordinates this flow, but the expensive or risky boundaries are isolated:

- Typst execution is contained in `@glyphweave/typst`.
- Raw HTML mutation is contained in `@glyphweave/html-adapter`.
- Runtime consumers read generated artifacts instead of invoking Typst directly.

## Trust Boundaries

`raw.html` is not trusted for direct rendering. It is useful for diagnostics, but only `content.html` is intended to be injected into an Astro page. The adapter validates URLs, strips unsafe nodes and attributes, and fails on local absolute paths before writing the final fragment.

## Output Contract

Every built post produces:

- `raw.html`: Typst's original HTML export.
- `content.html`: sanitized fragment for page injection.
- `toc.json`: heading list from `h1` through `h4`.
- `manifest.json`: compiler, hash, path, PDF, and asset metadata.
- `article.pdf`: optional PDF artifact when enabled.

The site-level `.glyphweave/content-index.json` is the entry point for Astro or another static site generator.
