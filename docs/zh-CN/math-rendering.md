# 复杂公式与内容捕获

Glyphweave 默认使用 `math.strategy: "hybrid"` 处理公式：

1. 编译 HTML 时注入 `glyphweave-html.typ` prelude。
2. prelude 对 `math.equation` 应用 `html.frame`，让复杂公式由 Typst 渲染为 SVG。
3. HTML Adapter 识别 `svg.typst-frame`，包装为 `.gw-math.gw-math--inline` 或 `.gw-math.gw-math--block`。
4. Adapter 为可匹配的源公式写入 `aria-label`、`data-gw-source` 和屏幕阅读器 fallback。
5. `manifest.json` 记录 `capture.math` 统计和 `diagnostics`。

示例：

```typst
简单公式 $a+b=c$、$x_1$、$n^2$ 保持在同一段落。

复杂行内公式 $sum_(i=1)^n x_i^2$ 会渲染为 SVG。

$
frac(a+b, c+d)
$
```

生成后的 HTML 结构类似：

```html
<span class="gw-math gw-math--inline" data-gw-renderer="typst-frame-svg" aria-label="Formula: sum_(i=1)^n x_i^2">
  <svg class="typst-frame">...</svg>
  <span class="gw-sr-only">Formula: sum_(i=1)^n x_i^2</span>
</span>
```

块级公式使用 `.gw-math--block`，默认样式会允许横向滚动，避免宽公式挤压正文。

## 配置

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

`native-only` 和 `disabled` 不注入 prelude。默认的 `hybrid` 会优先使用 Typst SVG frame，同时保留简单公式 MathML 恢复作为 fallback。

## Manifest

每篇文章的 manifest 包含：

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

如果 Typst 仍报告 `equation was ignored during HTML export`，默认配置会让构建失败。
