//! Native Typst frame export. Visible math never passes through SVG or MathML.
use anyhow::{Context, Result, anyhow, bail};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use std::{borrow::Cow, collections::HashMap, fs, path::PathBuf};
use typst::{
    diag::{FileError, FileResult},
    foundations::Bytes,
    layout::{Frame, FrameItem, Transform},
    syntax::{FileId, Source, Span, SyntaxKind, VirtualRoot},
    visualize::{Geometry, LineCap, Paint},
};
use typst_as_lib::{
    TypstEngine, file_resolver::FileResolver, typst_kit_options::TypstKitFontOptions,
};
use typst_html::{HtmlAttr, HtmlDocument, HtmlElement, HtmlNode};

struct FixedWorld<'a> {
    inner: &'a dyn typst::World,
    epoch: i64,
}
impl typst::World for FixedWorld<'_> {
    fn library(&self) -> &typst::utils::LazyHash<typst::Library> {
        self.inner.library()
    }
    fn book(&self) -> &typst::utils::LazyHash<typst::text::FontBook> {
        self.inner.book()
    }
    fn main(&self) -> FileId {
        self.inner.main()
    }
    fn source(&self, id: FileId) -> FileResult<Source> {
        self.inner.source(id)
    }
    fn file(&self, id: FileId) -> FileResult<Bytes> {
        self.inner.file(id)
    }
    fn font(&self, index: usize) -> Option<typst::text::Font> {
        self.inner.font(index)
    }
    fn today(
        &self,
        offset: Option<typst::foundations::Duration>,
    ) -> Option<typst::foundations::Datetime> {
        use chrono::Datelike;
        let seconds = offset.map(|o| o.seconds()).unwrap_or(0.0);
        let timestamp = self.epoch.checked_add(seconds as i64)?;
        let dt = chrono::DateTime::from_timestamp(timestamp, 0)?;
        typst::foundations::Datetime::from_ymd(dt.year(), dt.month() as u8, dt.day() as u8)
    }
}
struct SafeFiles {
    root: PathBuf,
}
impl SafeFiles {
    fn bytes(&self, id: FileId) -> FileResult<Vec<u8>> {
        let base = match id.root() {
            VirtualRoot::Package(package) => {
                let home = std::env::var_os("HOME")
                    .map(PathBuf::from)
                    .unwrap_or_default();
                let data = if cfg!(target_os = "macos") {
                    home.join("Library/Application Support")
                } else {
                    std::env::var_os("XDG_DATA_HOME")
                        .map(PathBuf::from)
                        .unwrap_or(home.join(".local/share"))
                };
                let cache = if cfg!(target_os = "macos") {
                    home.join("Library/Caches")
                } else {
                    std::env::var_os("XDG_CACHE_HOME")
                        .map(PathBuf::from)
                        .unwrap_or(home.join(".cache"))
                };
                let roots = [
                    std::env::var_os("TYPST_PACKAGE_PATH")
                        .map(PathBuf::from)
                        .unwrap_or(data.join("typst/packages")),
                    std::env::var_os("TYPST_PACKAGE_CACHE_PATH")
                        .map(PathBuf::from)
                        .unwrap_or(cache.join("typst/packages")),
                ];
                roots.iter().find_map(|root| {
                    let parent=root.canonicalize().ok()?;
                    let folder=parent.join(package.namespace.as_str()).join(package.name.as_str()).join(package.version.to_string()).canonicalize().ok()?;
                    folder.starts_with(&parent).then_some(folder)
                }).ok_or_else(||FileError::Other(Some("Typst package is not cached; fetch with the Typst CLI or vendor it locally".into())))?
            }
            _ => self.root.clone(),
        };
        let path = id
            .vpath()
            .realize(&base)
            .map_err(|_| FileError::AccessDenied)?;
        let real = path
            .canonicalize()
            .map_err(|e| FileError::from_io(e, &path))?;
        if !real.starts_with(&base) {
            return Err(FileError::AccessDenied);
        }
        fs::read(&real).map_err(|e| FileError::from_io(e, &real))
    }
}
impl FileResolver for SafeFiles {
    fn resolve_binary(&self, id: FileId) -> FileResult<Cow<'_, Bytes>> {
        Ok(Cow::Owned(Bytes::new(self.bytes(id)?)))
    }
    fn resolve_source(&self, id: FileId) -> FileResult<Cow<'_, Source>> {
        let text = String::from_utf8(self.bytes(id)?).map_err(|_| FileError::InvalidUtf8)?;
        Ok(Cow::Owned(Source::new(id, text)))
    }
}
// Source spans come from the evaluated equation, never from repr(content).
// Preserve delimiters, comments and whitespace; macro dependencies remain authored code.
fn equation_source(world: &dyn typst::World, span: Span) -> Option<String> {
    let source = world.source(span.id()?).ok()?;
    let found = source.find(span)?;
    let mut node = &found;
    let mut call = None;
    loop {
        if node.kind() == SyntaxKind::Equation {
            return Some(source.text().get(node.range())?.to_owned());
        }
        if call.is_none() && node.kind() == SyntaxKind::FuncCall {
            call = source.text().get(node.range()).map(|s| format!("#{s}"));
        }
        match node.parent() {
            Some(parent) => node = parent,
            None => return call,
        }
    }
}
fn capture_sources(elem: &mut HtmlElement, world: &dyn typst::World) {
    if attribute(elem, "data-gw-math").is_some() {
        let source = find_element(elem, &|e| e.tag.resolve().as_ref() == "math")
            .and_then(|math| equation_source(world, math.span));
        if let Some(source) = source {
            elem.attrs
                .push(HtmlAttr::intern("data-gw-typst-source").unwrap(), source);
        }
    }
    for child in elem.children.make_mut() {
        if let HtmlNode::Element(child) = child {
            capture_sources(child, world);
        }
    }
}
#[derive(Default)]
struct Outline {
    commands: Vec<Value>,
    scale: f64,
}
impl ttf_parser::OutlineBuilder for Outline {
    fn move_to(&mut self, x: f32, y: f32) {
        self.commands
            .push(json!({"op":"M","x":x as f64*self.scale,"y":y as f64*self.scale}));
    }
    fn line_to(&mut self, x: f32, y: f32) {
        self.commands
            .push(json!({"op":"L","x":x as f64*self.scale,"y":y as f64*self.scale}));
    }
    fn quad_to(&mut self, x1: f32, y1: f32, x: f32, y: f32) {
        self.commands.push(json!({"op":"Q","x1":x1 as f64*self.scale,"y1":y1 as f64*self.scale,"x":x as f64*self.scale,"y":y as f64*self.scale}));
    }
    fn curve_to(&mut self, x1: f32, y1: f32, x2: f32, y2: f32, x: f32, y: f32) {
        self.commands.push(json!({"op":"C","x1":x1 as f64*self.scale,"y1":y1 as f64*self.scale,"x2":x2 as f64*self.scale,"y2":y2 as f64*self.scale,"x":x as f64*self.scale,"y":y as f64*self.scale}));
    }
    fn close(&mut self) {
        self.commands.push(json!({"op":"Z"}));
    }
}
#[derive(Default)]
struct Export {
    glyphs: Vec<Value>,
    lookup: HashMap<String, usize>,
    frames: Vec<Value>,
    fonts: Vec<Value>,
}
fn paint(p: &Paint) -> Result<String> {
    match p {
        Paint::Solid(c) => Ok(c.to_hex().to_string()),
        _ => bail!("Unsupported gradient or tiled math paint"),
    }
}
// Export only mathematical structure. CSS, links and author HTML are not semantics.
const MATH_ATTRS: &[&str] = &[
    "display",
    "mathvariant",
    "stretchy",
    "fence",
    "separator",
    "accent",
    "accentunder",
    "columnalign",
    "rowalign",
    "columnspan",
    "rowspan",
    "displaystyle",
    "scriptlevel",
    "largeop",
    "movablelimits",
    "form",
    "linethickness",
    "notation",
];
fn attribute(e: &HtmlElement, name: &str) -> Option<String> {
    e.attrs
        .0
        .iter()
        .find(|(k, _)| k.resolve().as_ref() == name)
        .map(|(_, v)| v.to_string())
}
fn find_element<'a>(
    e: &'a HtmlElement,
    predicate: &impl Fn(&HtmlElement) -> bool,
) -> Option<&'a HtmlElement> {
    if predicate(e) {
        return Some(e);
    }
    e.children.iter().find_map(|n| match n {
        HtmlNode::Element(c) => find_element(c, predicate),
        _ => None,
    })
}
fn semantic_node(e: &HtmlElement, depth: usize) -> Result<Value> {
    if depth > 64 {
        bail!("Mathematical semantics exceeds depth limit");
    }
    let attrs: serde_json::Map<String, Value> = e
        .attrs
        .0
        .iter()
        .filter_map(|(k, v)| {
            let key = k.resolve().to_string();
            MATH_ATTRS
                .contains(&key.as_str())
                .then(|| (key, json!(v.to_string())))
        })
        .collect();
    let mut children = vec![];
    for child in &e.children {
        match child {
            HtmlNode::Text(t, _) => children.push(json!(t.to_string())),
            HtmlNode::Element(c) => children.push(semantic_node(c, depth + 1)?),
            HtmlNode::Tag(_) => {}
            HtmlNode::Frame(_) => {
                bail!("Embedded frames have no mathematical semantics; use supported math content")
            }
        }
    }
    Ok(json!({"tag":e.tag.resolve().to_string(),"attrs":attrs,"children":children}))
}
impl Export {
    fn frame(
        &mut self,
        frame: &Frame,
        x: f64,
        y: f64,
        marks: &mut Vec<Value>,
        text: &mut String,
    ) -> Result<()> {
        for (pos, item) in frame.items() {
            let (px, py) = (x + pos.x.to_pt(), y + pos.y.to_pt());
            match item {
                FrameItem::Group(g) => {
                    if g.clip.is_some() || g.transform != Transform::identity() {
                        bail!("Unsupported clipped or transformed mathematical frame");
                    }
                    self.frame(&g.frame, px, py, marks, text)?;
                }
                FrameItem::Text(t) => {
                    if t.stroke.is_some() {
                        bail!("Unsupported stroked mathematical text");
                    }
                    text.push_str(&t.text);
                    let color = paint(&t.fill)?;
                    let font = t.font.font();
                    let digest = format!("{:x}", Sha256::digest(font.data().as_slice()));
                    let instance = format!("{}:{}:{:?}", digest, font.index(), t.font.variations());
                    if let Some(os2) = t.font.ttf().tables().os2
                        && (matches!(
                            os2.permissions(),
                            Some(ttf_parser::os2::Permissions::Restricted)
                        ) || !os2.is_subsetting_allowed()
                            || !os2.is_outline_embedding_allowed())
                    {
                        bail!(
                            "Font does not permit outline subsetting: {}",
                            font.info().family
                        );
                    }
                    let family = font.info().family.to_string();
                    if !self.fonts.iter().any(|f| f["family"] == family) {
                        let license = t
                            .font
                            .ttf()
                            .names()
                            .into_iter()
                            .filter(|n| matches!(n.name_id, 0 | 13 | 14))
                            .filter_map(|n| n.to_string())
                            .collect::<Vec<_>>()
                            .join("\n");
                        self.fonts.push(json!({"family":family,"license":license}));
                    }
                    let (mut cx, mut cy) = (px, py);
                    for g in &t.glyphs {
                        let key = format!("{}:{}", instance, g.id);
                        let id = if let Some(i) = self.lookup.get(&key) {
                            *i
                        } else {
                            let mut path = Outline {
                                commands: vec![],
                                scale: 1000.0 / t.font.units_per_em(),
                            };
                            let bounds = t
                                .font
                                .ttf()
                                .outline_glyph(ttf_parser::GlyphId(g.id), &mut path);
                            if bounds.is_none()
                                && !t.text.get(g.range()).is_some_and(|text| {
                                    !text.is_empty() && text.chars().all(char::is_whitespace)
                                })
                            {
                                bail!("Glyph has no supported vector outline: {}", g.id);
                            }
                            let i = self.glyphs.len();
                            self.glyphs
                                .push(json!({"key":key,"commands":path.commands}));
                            self.lookup.insert(key, i);
                            i
                        };
                        marks.push(json!({"kind":"glyph","glyph":id,"x":cx+g.x_offset.at(t.size).to_pt(),"y":cy-g.y_offset.at(t.size).to_pt(),"size":t.size.to_pt(),"color":color}));
                        cx += g.x_advance.at(t.size).to_pt();
                        cy -= g.y_advance.at(t.size).to_pt();
                    }
                }
                FrameItem::Shape(s, _) => match &s.geometry {
                    Geometry::Line(p) => {
                        let stroke = s
                            .stroke
                            .as_ref()
                            .ok_or_else(|| anyhow!("Line has no stroke"))?;
                        if stroke.dash.is_some() || stroke.cap != LineCap::Butt {
                            bail!("Unsupported dashed/capped math rule");
                        }
                        let (dx, dy, w) = (p.x.to_pt(), p.y.to_pt(), stroke.thickness.to_pt());
                        if dx.abs() > 1e-9 && dy.abs() > 1e-9 {
                            bail!("Unsupported diagonal math rule");
                        }
                        let (rx, ry, rw, rh) = if dy.abs() < 1e-9 {
                            (px + dx.min(0.0), py - w / 2.0, dx.abs(), w)
                        } else {
                            (px - w / 2.0, py + dy.min(0.0), w, dy.abs())
                        };
                        marks.push(json!({"kind":"rect","x":rx,"y":ry,"width":rw,"height":rh,"color":paint(&stroke.paint)?}));
                    }
                    Geometry::Rect(size) if s.stroke.is_none() => {
                        marks.push(json!({"kind":"rect","x":px,"y":py,"width":size.x.to_pt(),"height":size.y.to_pt(),"color":paint(s.fill.as_ref().ok_or_else(||anyhow!("Rectangle has no fill"))?)?}));
                    }
                    _ => bail!("Unsupported mathematical shape; refusing partial output"),
                },
                FrameItem::Tag(_) => {}
                FrameItem::Link(_, _) => {
                    bail!("Links inside mathematical frames require semantic link export")
                }
                FrameItem::Image(_, _, _) => {
                    bail!("Images inside mathematical frames are not supported")
                }
            }
        }
        Ok(())
    }
    fn element(&mut self, elem: &mut HtmlElement, in_math: bool) -> Result<()> {
        let is_math = in_math
            || elem
                .attrs
                .0
                .iter()
                .any(|(k, _)| k.resolve().as_ref() == "data-gw-math");
        let semantic = if attribute(elem, "data-gw-math").is_some() {
            let marker = find_element(elem, &|e| attribute(e, "data-gw-semantic").is_some())
                .ok_or_else(|| {
                    anyhow!("Missing math semantics; update the Glyphweave HTML prelude")
                })?;
            let math = find_element(marker, &|e| e.tag.resolve().as_ref() == "math")
                .ok_or_else(|| anyhow!("Equation did not produce mathematical semantics"))?;
            let value = json!({"source":attribute(elem,"data-gw-typst-source"),"math":semantic_node(math,0)?,"alt":attribute(marker,"aria-label"),"lang":attribute(marker,"lang").unwrap_or_else(||"en".into())});
            elem.children.retain(|n| match n {
                HtmlNode::Element(e) => {
                    find_element(e, &|c| attribute(c, "data-gw-semantic").is_some()).is_none()
                }
                _ => true,
            });
            Some(value)
        } else {
            None
        };
        for node in elem.children.make_mut() {
            match node {
                HtmlNode::Element(e) => self.element(e, is_math)?,
                HtmlNode::Frame(f) if is_math => {
                    if !f.anchors.is_empty() {
                        bail!("Anchored mathematics requires anchor export");
                    }
                    let id = format!("gw-frame-{}", self.frames.len());
                    let mut items = vec![];
                    let mut text = String::new();
                    self.frame(&f.inner, 0.0, 0.0, &mut items, &mut text)?;
                    self.frames.push(json!({"id":id,"width":f.inner.width().to_pt(),"height":f.inner.height().to_pt(),"baseline":f.inner.baseline().to_pt(),"em":f.text_size.to_pt(),"text":text,"items":items,"semantics":semantic.clone().ok_or_else(||anyhow!("Math frame has no semantic owner"))?}));
                    let mut placeholder = HtmlElement::new(typst_html::tag::span).with_attr(
                        HtmlAttr::intern("data-gw-layout").map_err(|e| anyhow!("{e}"))?,
                        id,
                    );
                    if let Some(id) = &f.id {
                        placeholder.attrs.push(typst_html::attr::id, id.clone());
                    }
                    *node = HtmlNode::Element(placeholder);
                }
                _ => {}
            }
        }
        Ok(())
    }
}
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
