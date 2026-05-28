# Math Rendering and Capture

Glyphweave uses `math.strategy: "hybrid"` by default:

1. The HTML compiler injects the `glyphweave-html.typ` prelude.
2. The prelude renders `math.equation` with Typst `html.frame`, so complex formulas become SVG.
3. The HTML adapter recognizes `svg.typst-frame` and wraps it as `.gw-math.gw-math--inline` or `.gw-math.gw-math--block`.
4. The adapter adds source-backed `aria-label`, `data-gw-source`, and screen-reader fallback text when the formula can be matched.
5. `manifest.json` records `capture.math` statistics and `diagnostics`.

Example:

```typst
Simple formulas $a+b=c$, $x_1$, and $n^2$ stay in the surrounding paragraph.

Complex inline math $sum_(i=1)^n x_i^2$ renders as SVG.

$
frac(a+b, c+d)
$
```

Generated HTML looks like:

```html
<span class="gw-math gw-math--inline" data-gw-renderer="typst-frame-svg" aria-label="Formula: sum_(i=1)^n x_i^2">
  <svg class="typst-frame">...</svg>
  <span class="gw-sr-only">Formula: sum_(i=1)^n x_i^2</span>
</span>
```

Block formulas use `.gw-math--block`; the provided Astro CSS makes them horizontally scrollable.

## Configuration

```ts
export default defineConfig({
  math: {
    strategy: 'hybrid',
    failOnIgnoredEquation: true,
    includeSourceFallback: true,
    inlineVerticalShift: '0.08em',
  },
  capture: {
    strict: true,
    report: true,
  },
  typst: {
    wrapper: {
      injectPrelude: true,
    },
  },
})
```

`native-only` and `disabled` skip prelude injection. The default `hybrid` mode prefers Typst SVG frames and keeps conservative MathML recovery as a fallback for simple ignored inline equations.

## Manifest

Each post manifest includes:

```json
{
  "typst": {
    "features": ["html"],
    "preludeVersion": "glyphweave-html-1"
  },
  "capture": {
    "status": "ok",
    "math": {
      "sourceFormulaCount": 4,
      "typstFrameSvg": 4,
      "sourceFallbacks": 4,
      "mismatch": false
    }
  },
  "diagnostics": []
}
```

If Typst still reports `equation was ignored during HTML export`, the default config fails the build.
