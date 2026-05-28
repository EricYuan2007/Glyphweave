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
9. Recover simple inline equations that current Typst HTML export reports as ignored, when the raw output can be matched back to a single source line.

Only `content.html` should be injected into a page. `raw.html` is diagnostic output.

## Equation Recovery

Typst 0.14.x can emit warnings such as `equation was ignored during HTML export`. In that case the raw HTML may split one source line into multiple adjacent paragraphs and omit the equation entirely:

```typst
Given query $q$, search descends layer by layer.
```

```html
<p>Given query</p>
<p>, search descends layer by layer.</p>
```

Glyphweave reads the source `.typ` file during adaptation, matches the split paragraphs to the source line, and restores simple inline equations as MathML:

```html
<p>Given query <math class="gw-math" aria-label="q"><mi>q</mi></math>, search descends layer by layer.</p>
```

This recovery remains a conservative fallback for simple inline math on one source line, including identifiers, numbers, common operators, subscripts such as `$x_1$`, and superscripts such as `$n^2$`. The default path now injects the Glyphweave HTML prelude and renders complex formulas through Typst `html.frame` SVG; see [Math Rendering and Capture](./math-rendering.md).

## Sanitization Boundary

The sanitizer removes scriptable or layout-invasive constructs by default:

- `script`, `iframe`, `object`, `embed`, form controls, and style tags.
- Event attributes such as `onclick` and `onerror`.
- Inline `style` attributes.
- `javascript:` and `file:` URLs.
- Local absolute paths and assets that escape the post `assets/` directory.

The adapter does not attempt to preserve Typst's full page styling. Host sites should style the output through `.glyphweave-content`.
