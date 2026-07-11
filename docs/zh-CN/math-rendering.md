# 复杂公式与内容捕获

Glyphweave 要求 Typst 0.15.0 或更高版本，默认使用 `math.strategy: "mathml"`。Typst 会把每个公式导出为语义化 MathML，HTML Adapter 再将其包装为 `.gw-math--inline` 或 `.gw-math--block`，不会添加重复的屏幕阅读器文本。

```html
<span class="gw-math gw-math--inline" data-gw-renderer="native-mathml">
  <math>...</math>
</span>
```

原生 MathML 可选择、与分辨率无关，辅助功能也优于纯 SVG 公式。不同浏览器的排版可能有轻微差异，因此 Glyphweave 仍保留显式 SVG 模式，供更重视视觉一致性的站点使用。

## 配置

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

设置 `strategy: 'svg-frame'` 后，公式会通过 Typst `html.frame` 渲染。注入的 prelude 会用 `data-gw-math` 标记公式，Adapter 不再依赖 Typst 内部 SVG class。源公式 fallback 和 `inlineVerticalShift` 只作用于 SVG 模式。

Typst 0.14 时代的配置会被明确拒绝。请把 `hybrid`、`typst-frame` 或 `native-only` 改成 `mathml` 或 `svg-frame`，删除 `typst.wrapper.injectPrelude`、`failOnIgnoredEquation`，并把 SVG 专属选项移动到 `math.svg`。

## Manifest

Manifest schema version 2 会记录最终 renderer，并分别统计 MathML 与 SVG：

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

严格捕获模式会比较源公式数与 MathML、SVG 的合计数量，不一致时构建失败。
