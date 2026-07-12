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
      fonts: ['Songti SC', 'STSong', 'PingFang SC', 'Noto Serif CJK SC'],
      monoFonts: ['Menlo', 'DejaVu Sans Mono'],
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
