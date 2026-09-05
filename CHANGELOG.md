# Changelog

## Unreleased

### Fixed

- Guard output ownership and reject dangerous or symlinked clean/build paths.
- Publish complete immutable generations by atomically replacing the content index.
- Export only current published resources; remove stale PDFs and hidden post assets.
- Preserve omitted PDF metadata so project defaults work; surface PDF warnings.
- Reject broken explicit configs and unsupported configuration toggles.
- Sanitize a constrained HTML/MathML/SVG allowlist and normalize URL controls.
- Constrain real asset/source paths and enforce allowed asset extensions.
- Preserve heading references and unique IDs, including generated suffix collisions.
- Treat lexical math counts as advisory; fail strict capture on compiler-confirmed loss.

### Added

- Schema-validated artifact readers, shared publication policy and a search page.
- Compiled package entrypoints, declared dependencies and standalone installation test.
- Lifecycle regression tests, Astro checking, browser tests and real compiler fixtures.
- Contribution/security/support policies, issue/PR templates, ADR and migration guide.

### Changed

- Read artifact paths from `content-index.json`; do not hardcode `generated/posts`.
- Heading IDs default to preserving compiler IDs. Unsupported cache is explicitly disabled.
- See [migration notes](docs/migration.md) for configuration and output changes.

## 0.1.0

Initial Typst-to-HTML/PDF publishing pipeline and Astro example.
