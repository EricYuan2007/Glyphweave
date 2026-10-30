# Configuration contract

Glyphweave accepts only the current strict schema. There is no compatibility migration.

- `content.root` and `content.pattern`: standalone document discovery.
- `output.root` and `output.publicBasePath`: generation directory and public asset URL prefix.
- `typst.binary` and `typst.pdf`: compiler and optional PDF configuration.
- `html.headingIds`, `html.scopeClass`: HTML presentation boundary.
- `math.strategy`: `html-frame` (default), `mathml`, or `svg-frame`.
- `math.html.binary`: explicit native engine, or the packaged platform binary.
- `capture.strict`: fail on unsupported or incomplete equation capture.
- `assets.allowedExtensions`: allowed local asset suffixes.
- `cache.enabled`: reuse verified artifacts; CLI `--no-cache` forces compilation.

Sanitization, asset rewriting, capture reports and Typst HTML features are always enabled. They are not configurable fields. Unknown fields are errors.

`buildDocuments(root, config, loadDocuments)` lets the host choose documents directly, including private drafts for a local preview. `buildAll` applies standalone publication policy. Always consume paths from the committed content index.

Normal installation and compilation never invoke Cargo. Build the native engine explicitly with `pnpm build:native`, then make a platform archive with `pnpm pack`.
