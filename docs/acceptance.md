# Acceptance

Run these from a clean checkout with Node 22.18+, pnpm 11.1.1 and Typst 0.15.0:

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm run verify:demo
pnpm test:integration
pnpm test:package
pnpm exec playwright install
pnpm test:e2e
pnpm benchmark 100
```

## Gates

- Package compilation, ESLint (including no explicit any), TypeScript and Astro checks pass.
- Regression tests cover output ownership, bad configuration, failure preservation,
  publication state transitions, unsafe URLs, symlinks, unique IDs and JSON versions.
- Real compiler fixtures exercise comments, includes, macros, references, MathML and SVG.
- Standalone tarball installation runs the CLI and produces HTML/PDF with both renderers.
- Browser tests cover mathematical content, valid anchors, page overflow, keyboard
  lightbox dismissal and real search results in Chromium, Firefox, WebKit and mobile.
- Linux CI inspects PDF pages and embedded CJK/monospace fonts before deployment.
- The site exports only the current snapshot. No raw HTML or generation directory is deployed.

## Manual release checks

Inspect long equations, multilingual prose, PDF typography, focus order and
screen-reader output. Automated DOM/browser tests do not certify visual quality
or assistive-technology behavior. Windows is not currently in the verified matrix.
There is no promised scale/latency budget; benchmark records characterize their fixture only.
