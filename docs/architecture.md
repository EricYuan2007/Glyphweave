# Architecture

Glyphweave is a build-time publishing pipeline for trusted Typst authors. It emits
sanitized HTML, a TOC, manifests, an index and optional PDFs; the site does not run
the compiler at request time.

## Packages and dependency direction

| Package      | Responsibility                                     | Internal dependencies       |
| ------------ | -------------------------------------------------- | --------------------------- |
| schema       | Input and artifact runtime schemas, inferred types | none                        |
| typst        | CLI process, diagnostics, temporary wrappers       | schema                      |
| html-adapter | HTML/MathML/SVG normalization, constrained assets  | schema, typst               |
| core         | Discovery, generation, validation and commit       | schema, typst, html-adapter |
| cli          | Commands and user-facing diagnostics               | core, schema, typst, astro  |
| astro        | Validated readers and current-artifact export      | schema                      |

The adapter accepts a minimal post context and does not import core. Each package
has compiled JavaScript/declarations and declares its dependencies. Tests inject
compiler operations through `BuildDependencies`; real compiler tests validate the
boundary separately. Public API comments describe path bases and side effects.

## Data flow and commit

```text
post.yaml + index.typ + includes/assets
  -> discover and validate
  -> acquire output lock
  -> immutable generations/<id>/generated/posts/<slug>/
  -> compile HTML -> sanitize/normalize -> TOC and resources
  -> optional PDF -> schema-validated manifest
  -> schema-validated generation index
  -> atomic replacement of content-index.json
  -> snapshot reader -> manifest-selected export -> static site
```

An error before index replacement leaves the previous snapshot intact. Old
generations remain readable until explicit clean. Only the index is authoritative;
consumers must not enumerate generations or construct artifact paths. Concurrent
writers fail with a lock diagnostic. Clean requires a safe project-local owned
directory and is intended for use while no readers/builds run.

## Publication policy

Published public content enters routes, listings and search. Published unlisted
content gets a direct route but no listing/search entry. Private, draft and archived
content never enters production export. PDF failures configured as warnings keep
HTML, omit the PDF and emit a diagnostic. Export copies only current manifest files.

## Transform and trust boundaries

The HTML adapter uses a constrained allowlist for HTML/MathML/static SVG and a
numeric style policy. Shiki plus Glyphweave-owned controls are a trusted subsequent
transform. Raw HTML and logs are diagnostic artifacts and are not deployed.
Lexical formula counts are hints, not proofs of content loss; strict capture fails
compiler-confirmed loss. See [security](security.md), [math](math-rendering.md) and
[ADR 0001](decisions/0001-build-and-publication-contract.md).

Core separates build transactions (`build.ts`), one-article compilation (`build-post.ts`),
cache restoration (`cache.ts`), input/implementation fingerprints (`fingerprint.ts`),
and output ownership (`output.ts`). `typst/environment.ts` fingerprints compiler,
fonts and packages. Both compiler wrappers share one staging/cleanup implementation.
See [incremental caching](cache.md) for invalidation and reproducibility contracts.

Repository source is in `packages/`, runnable samples in `examples/minimal` and
`examples/astro-blog`, automated contracts in `tests/`, verification/benchmark
programs in `scripts/`, and maintained guidance in `docs/`. Historical reviews live
in Git history and PR discussions rather than competing with current documentation.
Root dependencies are development tools; runtime dependencies belong to their packages.
