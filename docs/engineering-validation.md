# Engineering validation — 2026-09-05

The historical [review](zh-CN/architecture-review-2026-09-05.md) refers to the original
`f6b7b07` snapshot. Current fixes are described in the [changelog](../CHANGELOG.md) and
[migration notes](migration.md).

## Regression coverage

F01: safe/owned clean and output paths; F02: manifest-selected publication and
visibility transitions; F03: immutable generations, index commit and lock tests;
F04: PDF precedence, config loading and rejected unsupported toggles; F05: allowlist
and normalized protocols; F06: real asset/source paths; F07: advisory lexical counts
and real compiler fixtures; F08: unique IDs and rewritten references.

Additional changes include explicit package dependencies, tarball installation,
validated readers, HAST types, source API comments, shared Astro data policy, a
search UI, and an early-Escape lightbox race fix discovered by browser tests.

## Executed checks

- 56 unit/regression tests passed; ESLint, TypeScript and Astro checks passed.
- Real Typst comments/includes/macros/cross-references passed with both renderers.
- Six standalone tarballs installed and generated HTML/PDF outside the workspace.
- All 8 browser tests passed across Chromium, Firefox, WebKit and a mobile viewport.
- Demo build generated 7 routes; Pagefind indexed the published article.

## Performance baseline

Command: `pnpm benchmark 100`. macOS arm64, Node v24.15.0, Typst 0.15.0.
One hundred synthetic posts, two formulas per post, no PDF or assets, serial builds,
cache disabled. First full build: 756 ms; second full build: 588 ms. Both emitted
69,700 HTML bytes and identical HTML content. Parent-process peak RSS: 154,664,960
bytes; this excludes compiler child-process peak memory. No statistical percentile
or general performance guarantee is inferred from two runs.

A repeat full build is not a cache hit. Incremental caching remains explicitly
unsupported pending dependency/font fingerprinting and equivalence validation.
Do not advertise future optimization proposals as completed functionality.

## Limits

These checks target trusted-author local compilation and static publication.
They do not establish a sandbox for hostile documents, online deployment atomicity,
Windows compatibility, or full screen-reader/PDF visual acceptance. See
[acceptance](acceptance.md) for repeatable commands and remaining manual release checks.
