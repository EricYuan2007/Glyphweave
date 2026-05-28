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

Only `content.html` should be injected into a page. `raw.html` is diagnostic output.
