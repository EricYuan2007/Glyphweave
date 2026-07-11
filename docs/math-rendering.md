# Math Rendering and Capture

Glyphweave requires Typst 0.15.0 or newer and uses `math.strategy: "mathml"` by default. Typst exports each equation as semantic MathML, and the HTML adapter wraps it as `.gw-math--inline` or `.gw-math--block` without adding duplicate screen-reader text.

```html
<span class="gw-math gw-math--inline" data-gw-renderer="native-mathml">
  <math>...</math>
</span>
```

Native MathML is selectable, resolution-independent, and more accessible than an equation rendered only as SVG. Rendering can vary slightly across browsers, so Glyphweave retains an explicit SVG mode for sites that prioritize visual consistency.

## Configuration

```ts
export default defineConfig({
  math: {
    strategy: 'mathml',
    svg: {
      includeSourceFallback: true,
      inlineVerticalShift: '0.08em',
    },
  },
  capture: {
    strict: true,
    report: true,
  },
})
```

Set `strategy: 'svg-frame'` to render equations through Typst `html.frame`. The injected prelude marks each formula with `data-gw-math`, so the adapter does not depend on Typst's internal SVG classes. Source-backed fallback text and `inlineVerticalShift` apply only to this SVG mode.

Configuration from Glyphweave's Typst 0.14 support is intentionally rejected. Replace `hybrid`, `typst-frame`, or `native-only` with `mathml` or `svg-frame`; remove `typst.wrapper.injectPrelude`, `failOnIgnoredEquation`, and top-level SVG options under `math`.

## Manifest

Manifest schema version 2 records the selected renderer and counts MathML and SVG separately:

```json
{
  "schemaVersion": 2,
  "typst": {
    "features": ["html", "mathml"],
    "mathRenderer": "mathml",
    "preludeVersion": null
  },
  "capture": {
    "status": "ok",
    "math": {
      "sourceFormulaCount": 4,
      "renderedCount": 4,
      "nativeMathml": 4,
      "typstFrameSvg": 0,
      "failed": 0,
      "mismatch": false
    }
  }
}
```

Strict capture fails when the source formula count differs from the combined MathML and SVG count.
