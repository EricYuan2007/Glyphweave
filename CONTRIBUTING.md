# Contributing to Glyphweave

Thank you for contributing. Read the [code of conduct](CODE_OF_CONDUCT.md) and
[architecture](docs/architecture.md) before changing a public contract.

## Development

Use Node.js 22.18+, pnpm 11.1.1 and Typst 0.15.0. Clone the repository, then run:

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm check
pnpm run verify:demo
pnpm exec playwright install
pnpm test:e2e
pnpm test:package
```

`build` produces JavaScript and declarations for all six workspace packages.
`verify:demo` also compiles real Typst documents and builds the site/search index.
Browser tests use the built site. PDF inspection needs Poppler and the fonts listed
in the Pages workflow. Build outputs and local PDFs must not be committed.

## Changes and pull requests

Create a focused branch from `main`. Explain the concrete problem and resulting
behavior. Add regression tests for defects, and include validation commands and
results. Update English and Chinese behavior documentation together. Record
cross-package contract changes in an ADR and the changelog. Prefer small,
reviewable commits; do not combine unrelated dependency upgrades with fixes.

Use the public package entrypoints rather than importing another package's source.
Keep the adapter independent of core. Disk JSON is parsed with its schema. Compiler
or filesystem failures must retain context and must not corrupt the committed index.
Public API comments document path bases, side effects and failure guarantees.

Automatic npm version PRs stay within validated major versions. Major upgrades
require a focused migration with runtime, schema, rendered-output or test-toolchain
evidence. In particular, Node types stay aligned with the lowest supported runtime,
Node 22. Minor, patch and security updates remain enabled.

## Issues and security

For bugs, include versions, a minimal Typst fixture, configuration and a redacted
error/log. For feature requests, describe the user workflow and alternatives.
Report vulnerabilities according to [SECURITY.md](SECURITY.md), not in a public
issue. Maintainers review contributions through pull requests and CI; a passing
example does not replace boundary tests.
