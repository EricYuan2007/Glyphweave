use anyhow::{Result, anyhow, bail};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use typst::{
    layout::{Frame, FrameItem, Transform},
    visualize::{Geometry, LineCap, Paint},
};
use typst_html::{HtmlAttr, HtmlElement, HtmlNode};
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
pub(crate) struct Export {
    pub(crate) glyphs: Vec<Value>,
    lookup: HashMap<String, usize>,
    pub(crate) frames: Vec<Value>,
    pub(crate) fonts: Vec<Value>,
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
pub(crate) fn attribute(e: &HtmlElement, name: &str) -> Option<String> {
    e.attrs
        .0
        .iter()
        .find(|(k, _)| k.resolve().as_ref() == name)
        .map(|(_, v)| v.to_string())
}
pub(crate) fn find_element<'a>(
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
    pub(crate) fn element(&mut self, elem: &mut HtmlElement, in_math: bool) -> Result<()> {
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
