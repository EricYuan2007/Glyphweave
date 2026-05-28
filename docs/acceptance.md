# Acceptance

Verified commands:

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm glyphweave build
pnpm --filter example-astro-blog build
pnpm --filter example-astro-blog pagefind
pnpm run verify:demo
```

Expected artifacts:

- `.glyphweave/content-index.json`
- `.glyphweave/generated/posts/<slug>/content.html`
- `.glyphweave/generated/posts/<slug>/toc.json`
- `.glyphweave/generated/posts/<slug>/manifest.json`
- optional `.glyphweave/generated/posts/<slug>/article.pdf`
- `examples/astro-blog/dist/posts/hnsw-search-notes/index.html`
- `examples/astro-blog/dist/pagefind/`

Manual checks:

- The article page renders Typst content as HTML, not a PDF iframe.
- Inline math appears as visible MathML, for example `q` in the demo article.
- The PDF download link points to `/glyphweave/posts/<slug>/article.pdf`.
- The final HTML contains `data-pagefind-body`.
- `content.html` does not contain scripts, event attributes, `javascript:` URLs, or local absolute paths.
