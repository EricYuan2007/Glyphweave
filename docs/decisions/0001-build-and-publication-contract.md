# ADR 0001: Build and publication contracts

Status: accepted for the current development line.

## Context

Directly overwriting multiple output files mixes generations on failure. Directory
enumeration also republishes old private/draft resources. Adapter types depended
back on core, and source-count heuristics rejected valid Typst programs.

## Decision

Keep the six-package build-time architecture. Core owns generation/commit and
compiler orchestration. The adapter takes a minimal post context, has no dependency
on core, and owns constrained HTML transforms. Compiler calls are injected in tests.

Build under `.glyphweave/generations/<id>/`. Validate the index and manifests, then
rename a temporary index over `content-index.json`. Readers hold one snapshot and
follow its paths. Keep old generations until explicit clean so in-flight readers
remain valid. Serialize writers with a lock; never steal a potentially live lock.
Clean is an administrative operation and must not run alongside readers.

Published public posts enter routes and listings; published unlisted posts enter
routes only. Private/draft/archived posts do not enter production outputs. Export
only manifest-listed current assets/PDFs. Deployment publishes the completed static
site, not the generation store or diagnostic raw HTML.

Lexical formula counts are advisory. Compiler-confirmed lost content fails strict
capture. SVG wrappers carry compiler-derived equation representations, avoiding
positional source assignment for actual builds. Keep the lexical scanner as a hint.

Package entrypoints are compiled JavaScript plus declarations. Distribution is
verified through local tarballs; this does not imply an npm release has occurred.

## Consequences

Builds use additional disk space; old generations are not a cache. Cache=true and
other unsupported toggles fail validation rather than silently doing nothing.
Future caching must fingerprint includes/assets/config/compiler/prelude/fonts and
prove equivalence to full builds. The local publisher replaces a staging directory
with rollback; it is not an online server deployment primitive.

Revisit this ADR for hostile-author compilation, online concurrent publication,
new compiler output formats, or measured large-site bottlenecks.
