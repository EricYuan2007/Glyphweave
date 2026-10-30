# PDF typography

The maintained PDF contract is implemented in [the Typst prelude](../packages/glyphweave/prelude/glyphweave-pdf.typ) and [configuration schema](../packages/glyphweave/src/schema/config.ts). Historical probe dumps and implementation diaries are not part of the distribution.

## Configuration

Enable PDF per article with `pdf: true`, or globally with `typst.pdf.enabledByDefault`. The default failure policy is `error`; hosts can explicitly choose `warn`.

`typst.pdf.template.profile` selects `editorial` (default) or `portable`. Editorial uses locally installed macOS CJK font candidates with Noto fallbacks; portable uses Noto Serif/Sans CJK SC and DejaVu Sans Mono. Latin defaults to Libertinus Serif. Explicit font arrays override profile defaults; body size defaults to 10.5 pt and accepts 8–14 pt.

The template owns text-frame calibration, CJK/Latin spacing, heading and display-math spacing, code styling and repeating table headers. These are current rendering rules, not a separate migration layer.

## Validation

Run `pnpm test:integration` after building the packages and installing Typst plus Poppler. [The PDF verifier](../tests/integration/verify-pdf-typography.mjs) checks measured text/heading/display spacing, natural math, hyphenation, cross-page table rows and embedded fonts against [the maintained fixture](../tests/fixtures/pdf/typography.typ). It creates disposable output outside the source tree.

Fonts must be installed separately. Their original license and embedding conditions remain applicable; choosing a profile does not distribute proprietary system fonts with the repository.
