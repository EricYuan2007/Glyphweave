# Native Typst HTML math backend

`html-frame` is the default Glyphweave backend. Typst 0.15.1 evaluates the complete document and performs mathematical layout. Glyphweave exports the resulting glyphs, rules, positions and baselines directly to static HTML/CSS and a per-article OpenType subset. It does not use MathJax, KaTeX, SVG, Canvas or browser MathML for visible mathematics. A separate, visually clipped MathML layer provides accessibility. Non-mathematical `html.frame` content still uses Typst's normal exporter.

## Build and enable

Rust 1.92 or newer is required to build the native executable. Workspace builds prepare it automatically using Cargo; subsequent builds reuse Cargo’s compilation cache. A prebuilt `glyphweave-typst-html` on PATH or `math.html.binary` avoids the Rust requirement. Development was tested with Rust 1.99.1; Cargo.lock pins the compiler libraries. The executable embeds Typst 0.15.1 and its standard fonts. The ordinary Typst CLI remains required for PDF output and environment checks and may be any compatible version from 0.15.0 onward.

```sh
pnpm install
pnpm build:packages
pnpm build:native
```

In the consuming project's `glyphweave.config.ts`:

```ts
import { defineConfig } from '@glyphweave/core'

export default defineConfig({
  math: {
    strategy: 'html-frame',
    html: {
      // Absolute path, a path relative to the consuming project, or a PATH executable.
      binary: '/path/to/Glyphweave/crates/typst-html/target/release/glyphweave-typst-html',
    },
  },
})
```

Run the usual `glyphweave build` and export current manifest assets with `exportGlyphweaveAssets`. Generated CSS, font and font notices are declared in each manifest. Consumers must copy all manifest assets, not just images. No browser script is needed. Changing back to `mathml` or `svg-frame` restores the previous backend.

## Ownership and data contract

- `crates/typst-html`: pinned native compiler bridge. The existing equation wrapper requests a Typst frame. The bridge intercepts `HtmlNode::Frame` **before** the SVG encoder, only within equation wrappers. It preserves the rest of Typst's HTML/link encoding.
- `packages/math-renderer`: validates layout v2, encodes glyph outlines in a generated font, and emits geometry CSS and semantic/source text alternatives.
- `packages/html-adapter/src/native-math.ts`: validates one-to-one placeholders, sanitizes author content, then inserts renderer-owned markup and assets as a trusted transform.
- `packages/core`: retains generation transactions, caches and atomic index replacement. The native executable bytes join the environment identity; renderer package bytes join the implementation identity.

The private compiler protocol is `glyphweave-typst-html ROOT INPUT OUTPUT [EPOCH]`. It writes `OUTPUT` and `OUTPUT.layout.json`. The sidecar includes a version/compiler identifier, font provenance, unique glyph outlines, and frames with `width`, `height`, `baseline`, `em`, text and drawing items. All geometry is in Typst points; outlines are normalized to a 1000-unit Y-up font grid. The adapter rejects mismatched, duplicate or missing frames.

## Layout calculations

Glyphweave does not infer formulas from `$...$` source scanning and does not recalculate fractions using heuristic CSS gaps. Typst supplies math style, font MATH metrics, script sizes, italic corrections, accent attachments, stretch assemblies, table alignment and row spacing. Macros/includes/context are resolved before export. Explicit source alignment choices remain Typst's choices.

For a frame with text size `e`, height `h` and baseline `b`, the HTML dimensions are `width/e`, `h/e` em and `vertical-align = (b-h)/e` em. For a glyph at frame origin `(x,y)` with size `s`, the origin is `(x/e,y/e)` and font-size is `s/e`. Text-run offsets are Y-up: the exported baseline subtracts y-offset/y-advance while frame coordinates are Y-down.

The generated font uses symmetric nonzero ascent and descent, both covering every outline. With CSS `line-height:0`, the baseline coincides with the zero-height line box, so the glyph box top is `y/e`. This also avoids Chromium rounding a half-pixel baseline down at odd pixel font sizes (such as STIX script-script glyphs at 11px). This avoids CoreText's zero-descent fallback and does not rely on browser-specific pixel shifts. Fractions/overlines remain separate rules at Typst's exact measured positions. CSS values preserve eight decimal places; OpenType CFF outline serialization rounds to the font grid (at most small subpixel differences at ordinary reading sizes).

Font glyphs use private-use characters because a shaped glyph ID cannot safely be mapped back to a Unicode character. Layout never asks the browser to shape the original formula again. Font names and source notices are retained in the generated font and the license asset; embedding/subsetting permission bits are checked. Font files and CSS use hashes of their final bytes. SFNT timestamps/checksums are normalized for repeatable bytes.

## Compatibility and current limits

Supported and tested: ordinary mathematical glyphs, nested fractions, radicals, accents, stretchy delimiters and assemblies, matrices, cases, aligned multiline equations, horizontal/vertical rules, solid-color glyphs, macros, local includes, overline, equation numbering/reference targets and inline baselines. System fonts and `TYPST_FONT_PATHS` are discovered; local/cached packages are readable. The bridge does not download packages: prefetch them with the Typst CLI or vendor sources. Files and package files cannot escape their respective roots through symlinks.

This is not a complete replacement for Typst's graphics exporter. Clipping, transformed frame groups, diagonal/arbitrary stroked curves, gradients/tilings, images and links inside math frames currently fail explicitly. Non-outline glyphs fail unless they represent whitespace. No silent conversion to MathJax, KaTeX or SVG occurs. Advanced anchors inside math frames also fail explicitly rather than being discarded. Ordinary external references to numbered equations were exercised separately.

The visible glyph layer is hidden from accessibility APIs. Protocol v2 also carries a bounded MathML tree generated by Typst from the **same evaluated equation**, including macros, fractions, roots, scripts, matrices and cases. The bridge removes the temporary semantic carrier before HTML serialization, preserving the visible frame and original equation anchors/counters. The renderer emits one clipped semantic MathML root per equation, without `display:none`, `visibility:hidden` or `aria-hidden` on that layer. The visual wrapper has no competing `role=math` or flattened label. Allowed MathML tags/attributes are checked and all text/attribute values escaped; scripts, links, event attributes and arbitrary HTML are rejected.

Use `#math.equation($ (a+b)/2 $, alt: "a 加 b 的和除以二")` for an author-written explanation and `#set text(lang: "zh")` for the language. Author `alt` becomes the MathML accessible name; without it, native structural semantics remain available. This is Presentation MathML, not inferred Content MathML: ambiguous notation still benefits from an author description. Actual speech and navigation depend on the browser/screen reader pair. Automated checks verify Chromium's platform accessibility tree and all three engines' semantic DOM; VoiceOver/NVDA/JAWS end-to-end speech has not been manually certified.

Font loading is required for visual output; no client font-failure UI is shipped. Copying original Typst source is not implemented. Wide expressions scroll rather than automatically reflow. Forced-color mode uses system foreground colors for glyphs and rules.

The generated fonts are local derived assets. A font's permission bits are not a replacement for its license; check the emitted font notices before redistribution.

## Validation and reproduction

See `research/typst-html-renderer-2026-10-28/plan.md` for the preimplementation plan and `report.md` for actual results and exclusions. The 50 fixtures are a development corpus, not a blind benchmark. The comparison page uses Typst SVG only as a verification oracle, not as an input to the new backend.

```sh
pnpm test
pnpm typecheck
pnpm lint
pnpm test:package
pnpm test:native
```

`pnpm test:native` builds the native bridge and fixtures, then runs the browser and integration checks. Detailed verification scripts live in that research directory: `integration.mjs` exercises cache/export/rollback, `geometry.mjs` measures actual browser glyph baselines and origins, and `compare.mjs` creates the 50-pair visual gallery. `check.mjs` checks all formulas in Chromium/Firefox/WebKit at two viewport widths. These scripts require the native binary, generated fixtures and installed Playwright browsers; they are not silently substituted for ordinary unit tests.

## Serif defaults

The HTML and PDF preludes retain New Computer Modern Math for mathematical glyphs and stretchy delimiters. CJK conditions prefer Noto Serif CJK SC, Songti SC, then STSong. Install the chosen fonts in the build environment; explicit author font choices remain available. STIX Two Math was evaluated but not retained after visual review of its delimiter shapes.

## Selecting and copying equations

The native compiler records the equation’s original source span, including `$` delimiters, whitespace and comments. Selection exposes that source as ordinary text without changing glyph layout or the accessible MathML tree. No source is reconstructed from `repr(content)` or private glyph codes.

For whole-formula highlighting and correct copying across prose and equations, initialize the small browser module once:

```ts
import { installMathCopy } from '@glyphweave/math-renderer/browser'
installMathCopy()
```

The Astro example and InkStack already initialize it. A partial selection inside a formula copies the complete formula; a mixed selection preserves surrounding prose. This only handles an actual copy event and never reads the clipboard. The source overlay is excluded from assistive technology and Pagefind indexing.

An equation constructed with `math.equation(...)` preserves its source expression. Macros and variables still need their original definitions when pasted elsewhere. Dynamically generated content without an attributable source span has no source overlay; mathematical accessibility remains available.

`math.strategy: 'mathml'` and `'svg-frame'` remain explicit alternatives. Neither is silently substituted if the native engine cannot build.
