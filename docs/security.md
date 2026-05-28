# Security

Phase 1 assumes trusted Typst authors, but it still guards the generated HTML boundary.

Builds fail or sanitize output for:

- `<script>`, `<iframe>`, `<object>`, `<embed>`, forms, inputs, buttons, and style tags.
- Event attributes such as `onclick` and `onerror`.
- `javascript:` and `file:` URLs.
- Local absolute paths such as `/Users/...`, `/home/...`, `~/...`, and Windows user paths.
- Assets outside the post `assets/` directory.

Astro examples never inject `raw.html`; only adapter-produced `content.html` is used.

## Recommended Deployment Rules

- Commit source posts, examples, tests, and documentation.
- Do not commit `.glyphweave`, Astro `dist`, generated Pagefind output, local `.npmrc`, or copied public artifacts.
- Run `pnpm check` and `pnpm run verify:demo` before merging changes.
- Treat Typst HTML export upgrades as compatibility events and rerun fixture builds before publishing.

## Current Limitations

Phase 1 assumes trusted authors. It still protects the page injection boundary, but it is not a server-side sandbox for untrusted Typst documents. Future server compilation should add filesystem isolation, time limits, package controls, and storage-level artifact validation.
