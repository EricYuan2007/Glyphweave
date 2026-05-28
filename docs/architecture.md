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
