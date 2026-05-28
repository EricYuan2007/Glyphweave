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

## Inline formulas disappear

Typst 0.14.x can ignore equations on its native HTML export path. The default config injects the Glyphweave HTML prelude and renders complex formulas with `html.frame` SVG; if Typst still reports `equation was ignored during HTML export`, the build fails. Check `.glyphweave/logs/<slug>.html.log`, confirm `typst.wrapper.injectPrelude` is enabled, and make sure `math.strategy` is not `native-only` or `disabled`.
