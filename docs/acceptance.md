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
- Inline and block math render through `.gw-math` wrappers with native MathML by default.
- Complex examples such as `sum_(i=1)^n x_i^2`, `integral_0^1 f(x) dif x`, `frac`, `mat`, and `cases` are visible in the demo article.
- The schema v2 manifest contains `capture.math`, `diagnostics`, and `typst.mathRenderer`.
- Default builds report all formulas as `nativeMathml`; `svg-frame` builds use Glyphweave-owned markers.
- PDF-enabled posts record `typst.pdfPreludeVersion` when the Glyphweave PDF template is active.
- The PDF download link points to `/glyphweave/posts/<slug>/article.pdf`.
- The final HTML contains `data-pagefind-body`.
- `content.html` does not contain scripts, event attributes, `javascript:` URLs, or local absolute paths.
- Chromium desktop/mobile checks have no page overflow, clipped equations, or baseline regressions.
- Safari and Firefox should be checked manually for MathML alignment before a production release.
