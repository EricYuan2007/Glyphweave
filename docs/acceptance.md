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
```

Expected artifacts:

- `.glyphweave/content-index.json`
- `.glyphweave/generated/posts/<slug>/content.html`
- `.glyphweave/generated/posts/<slug>/toc.json`
- `.glyphweave/generated/posts/<slug>/manifest.json`
- optional `.glyphweave/generated/posts/<slug>/article.pdf`
- `examples/astro-blog/dist/posts/hnsw-search-notes/index.html`
- `examples/astro-blog/dist/pagefind/`
