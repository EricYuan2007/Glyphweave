# Migration and configuration

This development update changes output paths and tightens configuration validation.
Run `pnpm install --frozen-lockfile && pnpm build` after updating the checkout.

## Outputs

Read `.glyphweave/content-index.json` and follow the paths it contains. Files now
live in immutable `generations/<id>/generated/posts/<slug>/` directories. Old paths
must not be constructed manually. `inspect <slug>` resolves the current generation.
Old generations stay local until `clean`; never upload the entire `.glyphweave` tree.

Build adopts only empty/recognized legacy output directories, then writes an
ownership marker. `clean` refuses unmarked directories. If migrating a legacy
output, run a successful build before clean. Back up any manually added files.
Only dedicated project-local output directories are supported; project/source
roots, reserved code directories and symlinks are rejected.

## Configuration

- Omitted `pdf` inherits `typst.pdf.enabledByDefault`; explicit false disables it.
- `html.headingIds` defaults to `preserve`; `stable` rewrites IDs and local links.
- `html.scopeClass` is applied to the fragment wrapper.
- `assets.allowedExtensions` is enforced; resource real paths must stay in assets/.
- `cache.enabled` defaults to true; `build --no-cache` forces compilation. See [cache](cache.md).
- `html.sanitize`, `assets.copy`, `capture.report`, `typst.htmlFeatures` only accept true.
- Unknown top-level options and invalid dates are rejected.
- A missing implicit default config is allowed. An explicit missing config, broken
  import or syntax error fails with the config path.
- `capture.strict` fails compiler-confirmed content loss. Lexical count differences
  remain warnings because includes and macros alter rendered cardinality.

Published unlisted pages are directly accessible but excluded from lists and search.
Draft, archived and private content is not exported. PDF warning mode keeps HTML,
omits failed PDF output, and records a warning in the manifest and CLI summary.

TypeScript config requires a runtime supporting it (Node 22.18+); the workspace CLI
also runs through tsx. Plain `.mjs` config works through `--config` in installed tools.

The repository starter content/config now lives in `examples/minimal`; use
`pnpm glyphweave build --root examples/minimal`. The full site is in `examples/astro-blog`.
Typst creation time is pinned to the post updated/date (UTC), or `SOURCE_DATE_EPOCH`.
This makes `datetime.today()` and PDF metadata reproducible; update the date explicitly
when the article should render a new date.

The example now pins Astro 7.2.10. Its Pagefind loader lives in public/scripts/search.js
because Pagefind is generated after the Astro bundle; bundling its runtime dynamic
import left an unresolved Vite preload marker. See the [Astro upgrade guide](https://docs.astro.build/en/guides/upgrade-to/v7/)
when adapting other integrations. Run `pnpm run audit` against the official npm registry.
