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

## 行内公式消失

Typst 0.14.x HTML export 原生路径可能忽略公式。默认配置会注入 Glyphweave HTML prelude，用 `html.frame` 把复杂公式输出为 SVG；如果仍出现 `equation was ignored during HTML export`，构建会失败。请检查 `.glyphweave/logs/<slug>.html.log`，确认 `typst.wrapper.injectPrelude` 没有关闭，且 `math.strategy` 不是 `native-only` 或 `disabled`。
