# Troubleshooting

## Typst is missing

Run:

```bash
typst --version
pnpm glyphweave doctor
```

Install Typst if the command is not found.

## PDF fails but HTML should still build

Set `typst.pdf.failure` to `warn` in `glyphweave.config.ts`. HTML compile failures still fail the build.

## PDF Chinese text uses poor or missing fonts

Glyphweave wraps PDF builds with a Typst template by default. The default font stack targets macOS:

```ts
typst: {
  pdf: {
    template: {
      enabled: true,
      fonts: ['Songti SC', 'STSong', 'PingFang SC'],
      monoFonts: ['Menlo'],
      lang: 'zh',
      region: 'CN',
    },
  },
}
```

On Linux or CI, install a CJK font and set `typst.pdf.template.fonts` to the installed family, for
example `Noto Serif CJK SC` or `Source Han Serif SC`. Run `typst fonts` to see the exact family
names available to Typst. Set `typst.pdf.template.enabled` to `false` if your source `.typ` file
already applies a full document template.

## Asset paths fail

Move local resources into the post's `assets/` directory and reference them relatively, for example:

```typst
#image("assets/figure.png")
```

## Pagefind install is unavailable

The example site depends on the official `pagefind` package. If the native binary download times out, retry with a longer fetch timeout or a closer npm registry:

```bash
pnpm config set registry https://registry.npmmirror.com
pnpm install --fetch-timeout 600000
```

## Commands need to run from another directory

Every CLI command accepts `--root <dir>`, for example:

```bash
pnpm glyphweave build --root /path/to/site
pnpm glyphweave clean --root /path/to/site
```

## Typst is too old

Glyphweave requires Typst 0.15.0 or newer because native HTML equations rely on MathML. Homebrew installations can be upgraded with:

```bash
brew update && brew upgrade typst
pnpm glyphweave doctor
```

## Formulas are missing or misaligned

Check `.glyphweave/logs/<slug>.html.log` and the manifest's `capture.math` section. The default `mathml` mode should report matching `sourceFormulaCount` and `renderedCount`. Use `svg-frame` only when cross-browser visual consistency is more important than selectable, semantic formulas.
