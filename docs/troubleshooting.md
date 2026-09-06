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
      profile: 'editorial',
      fontSize: 10.5,
      lang: 'zh',
      region: 'CN',
    },
  },
}
```

On Linux or CI, install `Noto Serif CJK SC`, `Noto Sans CJK SC`, and a monospace fallback. On
Ubuntu, `sudo apt-get install fonts-noto-cjk fonts-dejavu-core` provides the families used by the
default stack. Run `typst fonts` to verify the exact names available to Typst. Set
`typst.pdf.template.enabled` to `false` if your source `.typ` file already applies a full document
template.

Set `profile: 'portable'` for Noto Serif CJK SC body, Noto Sans CJK SC headings, and DejaVu Sans Mono
code. This profile fails PDF compilation if any configured family is missing; `pdf.failure` still
controls whether that aborts the build or omits the PDF with a warning. The default `editorial` profile
prefers macOS fonts, with Noto fallbacks. Neither profile downloads fonts or pins their installed versions.

`fontSize` accepts 8–14 points (default 10.5). Ordinary body baseline spacing is calibrated to 1.6×
the body size; tall equations may need more room. `fonts`, `latinFonts`, `headingFonts`, and `monoFonts`
override the corresponding profile defaults. `latinFonts` defaults to `['Libertinus Serif']`; use `[]`
to use the body stack's Latin glyphs instead. Required font stacks cannot be empty. Chinese emphasis
uses bold upright glyphs; Latin emphasis uses a real italic face. Headings retain 13.5pt and their
existing numbering, with uniform 18pt above and 12pt below. Display equations use 1em above/below
(collapsing between adjacent blocks) and independent 0.5em multiline leading.
Code listings, captions, and footnotes use 8.5pt, and table text and bibliography entries use 9pt.

Code listings use the page background with no border; monospace, gray line numbers, and whitespace
separate them from prose while retaining syntax highlighting.

Missing font families produce `typst-font-missing` manifest diagnostics. An unavailable fallback does
not necessarily mean a missing glyph; inspect `typst fonts --variants` and the PDF's embedded fonts.
Configure only installed families to remove irrelevant fallback warnings. Native inline-code wrapping
preserves the text without inserted soft hyphens, and tables inside figures can paginate.

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

See [migration notes](migration.md) for current output and configuration contracts.
