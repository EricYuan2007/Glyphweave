//! Native Typst frame export. Visible math never passes through SVG or MathML.
mod frame;
mod source;
mod world;
use anyhow::{Context, Result, anyhow, bail};
use frame::Export;
use serde_json::json;
use source::capture_sources;
use std::{fs, path::PathBuf};
use typst_as_lib::{TypstEngine, typst_kit_options::TypstKitFontOptions};
use typst_html::HtmlDocument;
use world::{FixedWorld, SafeFiles};
fn run() -> Result<()> {
    let args: Vec<_> = std::env::args().collect();
    if args.len() == 2 && args[1] == "--version" {
        println!("glyphweave-typst-html 0.1.0 (Typst 0.15.1; layout-v2)");
        return Ok(());
    }
    if args.len() != 4 && args.len() != 5 {
        bail!("Usage: glyphweave-typst-html ROOT INPUT OUTPUT [EPOCH]");
    }
    let epoch = args
        .get(4)
        .map(|s| s.parse::<i64>())
        .transpose()?
        .unwrap_or(0);
    let root = PathBuf::from(&args[1]).canonicalize()?;
    let source = PathBuf::from(&args[2]).canonicalize()?;
    let relative = source
        .strip_prefix(&root)
        .context("Input must be inside root")?
        .to_string_lossy()
        .replace('\\', "/");
    let font_paths = std::env::var_os("TYPST_FONT_PATHS")
        .map(|p| std::env::split_paths(&p).collect::<Vec<_>>())
        .unwrap_or_default();
    let engine = TypstEngine::builder()
        .search_fonts_with(TypstKitFontOptions::new().include_dirs(font_paths))
        .add_file_resolver(SafeFiles { root })
        .build();
    let result = engine
        .with_world(relative.as_str(), |world| {
            let mut result = typst::compile::<HtmlDocument>(&FixedWorld {
                inner: world,
                epoch,
            });
            if let Ok(doc) = &mut result.output {
                capture_sources(doc.root_mut(), world);
            }
            result
        })
        .map_err(|e| anyhow!("{e:?}"))?;
    for warning in &result.warnings {
        eprintln!("warning: {}", warning.message);
    }
    let mut doc = result
        .output
        .map_err(|e| anyhow!("Typst compilation failed: {e:?}"))?;
    let mut export = Export::default();
    export.element(doc.root_mut(), false)?;
    let html = typst_html::html(&doc, &Default::default())
        .map_err(|e| anyhow!("HTML encoding failed: {e:?}"))?;
    fs::write(&args[3], html)?;
    fs::write(
        format!("{}.layout.json", args[3]),
        serde_json::to_vec(
            &json!({"version":2,"compiler":"typst-0.15.1","glyphs":export.glyphs,"frames":export.frames,"fonts":export.fonts}),
        )?,
    )?;
    Ok(())
}
fn main() {
    if let Err(e) = run() {
        eprintln!("glyphweave-native-layout: {e:#}");
        std::process::exit(1)
    }
}
