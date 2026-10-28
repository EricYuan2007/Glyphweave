# @glyphweave/math-renderer

Static HTML/CSS and OpenType font rendering for Glyphweave native Typst layout frames.

Typst owns mathematical layout. This package validates the versioned frame protocol and preserves its glyph origins, rules, dimensions and baselines. It does not parse Typst or depend on MathJax or KaTeX. Use through Glyphweave’s opt-in `html-frame` backend; see `docs/native-math-renderer.md` in the repository for setup and supported geometry.
