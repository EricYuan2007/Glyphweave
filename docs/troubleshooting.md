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

Typst 0.14.x may warn that equations were ignored during HTML export. Glyphweave recovers simple inline equations when the raw HTML split can be matched to one source line. If a complex formula is still missing, check `.glyphweave/logs/<slug>.html.log` for Typst warnings and simplify the formula or wait for broader Typst HTML math support.
