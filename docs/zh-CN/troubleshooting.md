# 故障排查

## 找不到 Typst

```bash
typst --version
pnpm glyphweave doctor
```

如果命令不存在，请先安装 Typst CLI。

## PDF 失败但希望 HTML 继续构建

在 `glyphweave.config.ts` 中设置：

```ts
typst: {
  pdf: {
    failure: 'warn',
  },
}
```

HTML 编译失败仍然会让构建失败。

## PDF 中文字体效果不好或缺字

Glyphweave 默认会用 Typst 模板包裹 PDF 构建。默认字体栈面向 macOS：

```ts
typst: {
  pdf: {
    template: {
      enabled: true,
      profile: 'editorial',
      fontSize: 10.5,
      lang: 'zh',
      region: 'CN',
    },
  },
}
```

Linux 或 CI 环境请安装 Noto CJK 与等宽回退字体。Ubuntu 可运行
`sudo apt-get install fonts-noto-cjk fonts-dejavu-core`，然后用 `typst fonts` 确认
`Noto Serif CJK SC`、`Noto Sans CJK SC` 和 `DejaVu Sans Mono` 均可用。如果文章源码
已经套了完整 Typst 模板，可以设置 `typst.pdf.template.enabled: false`。

Linux 可设置 `profile: 'portable'`，选择上述 Noto/DejaVu 字体；任何配置字体未安装时会使
PDF 编译失败，再按 `pdf.failure` 决定是否中止整站构建。`editorial` 则保留后备字体并报告
`typst-font-missing`，缺失后备字体不一定等于缺字。字体警告会写入 manifest。
两个 profile 均不会自动下载字体。

`fontSize` 默认 10.5pt，范围 8–14；`fonts`、`latinFonts`、`headingFonts`、`monoFonts`
可独立指定。英文默认使用 Libertinus Serif，设 `latinFonts: []` 可改用正文栈的拉丁字形。
具体样式与字体配置见 [PDF 使用指南](usage.md#pdf-模板与中文字体)。

## 资源路径失败

把图片、附件等移动到文章目录的 `assets/` 内，并使用相对路径：

```typst
#image("assets/figure.png")
```

## Pagefind 安装超时

官方 `pagefind` 包会下载平台二进制。网络较慢时可以切换 registry 并增加超时时间：

```bash
pnpm config set registry https://registry.npmmirror.com
pnpm install --fetch-timeout 600000
```

## Typst 版本过低

Glyphweave 要求 Typst 0.15.0 或更高版本，因为原生 HTML 公式依赖 MathML。Homebrew 安装可以这样升级：

```bash
brew update && brew upgrade typst
pnpm glyphweave doctor
```

## 公式缺失或对齐异常

请检查 `.glyphweave/logs/<slug>.html.log` 和 manifest 的 `capture.math`。默认 `mathml` 模式下，`sourceFormulaCount` 应与 `renderedCount` 一致。只有在跨浏览器视觉一致性比公式可选择性和语义更重要时，才使用 `svg-frame`。

当前行为及破坏性变更见[迁移说明](migration.md)。
