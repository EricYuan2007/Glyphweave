# Security

Phase 1 assumes trusted Typst authors, but it still guards the generated HTML boundary.

Builds fail or sanitize output for:

- `<script>`, `<iframe>`, `<object>`, `<embed>`, forms, inputs, buttons, and style tags.
- Event attributes such as `onclick` and `onerror`.
- `javascript:` and `file:` URLs.
- Local absolute paths such as `/Users/...`, `/home/...`, `~/...`, and Windows user paths.
- Assets outside the post `assets/` directory.

Astro examples never inject `raw.html`; only adapter-produced `content.html` is used.
