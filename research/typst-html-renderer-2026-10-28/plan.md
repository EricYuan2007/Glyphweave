# Typst HTML renderer: implementation and acceptance plan

## Contract

Implement in Glyphweave, preserving current HTML/PDF publication contracts and existing backends. No MathJax or KaTeX runtime/build dependency; their box, metric and baseline design is reference only. Reuse Typst's mathematical shaping/layout instead of approximating TeX spacing with CSS. Emit static HTML/CSS and fonts, with no SVG/MathML dependency for visible formula rendering. Start as an explicit optional backend until acceptance is established.

## Architecture and order

1. Verify Typst 0.15.1 HtmlDocument exposes frames before SVG encoding. If available, compile the existing equation wrapper and replace its frame nodes with renderer-owned placeholders. Export a versioned JSON layout sidecar with dimensions, baseline, glyph origins, paths/rules, source metadata and font identity. Preserve evaluated macros, imports, context and numbering by compiling the complete document, not extracted source strings.
2. Implement a small Rust compiler bridge pinned to Typst. Own source/font resolution explicitly. Never serialize SVG as a hidden intermediate. Reject unsupported geometry rather than quietly losing it.
3. Implement HTML layout from frame geometry. Preserve measured coordinates; convert pt to em once against formula text size. Resolve shaped glyph IDs using a generated local font mapping, not Unicode assumptions. Handle rules and transforms explicitly. Preserve semantic/source fallback separately from visual glyphs.
4. Integrate an opt-in strategy through schema, compiler, adapter, manifest, cache identity and resource export. Generated style values are finite validated geometry; author HTML stays subject to existing sanitation. Fail before atomic publication on an unsupported render or bad sidecar.
5. Validate with baseline Typst frame rasterization, structural invariants, macro/overline cases, existing 50 fixtures and independent stress cases. Inspect Chromium, Firefox and WebKit at desktop/mobile widths. Verify font loading, inline baseline, nested cases, stretchy delimiters, superscripts and clipping. Run project regression suites.

## Measurable gates

- Layout coordinates and dimensions must be finite; font/glyph references resolve; no formula silently omitted.
- Typst layout dimensions/baseline survive export without arbitrary visual correction constants. Export precision >= 1e-4 pt.
- New visual math contains no SVG, native MathML, Canvas or client-side typesetting script.
- Font-load failures and unsupported operations are surfaced; no conversion from glyph ID to guessed Unicode.
- All development fixtures compile and remain readable in 3 browser engines. Pixel comparisons allow antialiasing differences and are reported separately from geometry equality, not claimed as universal aesthetic proof.
- Existing strategies retain compatibility; cache invalidates for renderer binary/font changes; failed builds preserve last published index.

## Risks and stopping rules

Glyph font embedding/subsetting license restrictions, arbitrary painted shapes, clipping, variable font instances and semantic reading order require explicit handling. Do not silently fall back to the prohibited renderer dependencies. Document any unsupported feature with a diagnostic and tests. If the public Frame interface is insufficient, record the exact obstruction before selecting a different bridge. No deployment or automatic InkStack vendor overwrite.

## Sources

Typst v0.15.1 source: typst-html encoding, HtmlDocument/HtmlNode, FrameItem/TextItem; MathJax 4.1.3 common fraction layout and CHTML wrappers; KaTeX 0.19.1 fraction, spacing and accent source inspected in the preceding study. Pin concrete dependencies in Cargo.lock/package lock; keep research and implementation claims distinct.
