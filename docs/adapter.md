# HTML Adapter

The adapter is the security and stability boundary between Typst raw HTML and a blog runtime.

It performs these steps:

1. Parse raw HTML into a HAST tree.
2. Extract `<body>` children when a full document is present.
3. Normalize heading IDs with stable Unicode slugs.
4. Extract `h1` through `h4` into `toc.json`.
5. Copy article-local assets and rewrite public paths.
6. Add `rel="noopener noreferrer"` to external links.
7. Remove dangerous tags and attributes.
8. Reject local absolute paths and unsafe URL protocols.
9. Normalize Typst 0.15 MathML and Glyphweave-marked SVG equations into stable wrappers.

Only `content.html` should be injected into a page. `raw.html` is diagnostic output.

## Equation Normalization

Typst 0.15 exports equations as native MathML. The adapter preserves the complete MathML tree and wraps each equation with a stable renderer marker. Block equations are identified through `display="block"`; all other equations remain inline. The optional SVG strategy uses Glyphweave-owned `data-gw-math` attributes rather than Typst's internal SVG classes. See [Math Rendering and Capture](./math-rendering.md).

## Sanitization Boundary

The sanitizer removes scriptable or layout-invasive constructs by default:

- `script`, `iframe`, `object`, `embed`, form controls, and style tags.
- Event attributes such as `onclick` and `onerror`.
- Inline `style` attributes.
- `javascript:` and `file:` URLs.
- Local absolute paths and assets that escape the post `assets/` directory.

The adapter does not attempt to preserve Typst's full page styling. Host sites should style the output through `.glyphweave-content`.
