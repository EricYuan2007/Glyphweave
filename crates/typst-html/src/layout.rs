//! Typed wire format consumed by the TypeScript layout validator.
use serde::Serialize;
use std::collections::BTreeMap;

#[derive(Serialize)]
#[serde(tag = "op")]
pub(crate) enum Command {
    M {
        x: f64,
        y: f64,
    },
    L {
        x: f64,
        y: f64,
    },
    Q {
        x1: f64,
        y1: f64,
        x: f64,
        y: f64,
    },
    C {
        x1: f64,
        y1: f64,
        x2: f64,
        y2: f64,
        x: f64,
        y: f64,
    },
    Z,
}
#[derive(Serialize)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub(crate) enum Item {
    Glyph {
        glyph: usize,
        x: f64,
        y: f64,
        size: f64,
        color: String,
    },
    Rect {
        x: f64,
        y: f64,
        width: f64,
        height: f64,
        color: String,
    },
}
#[derive(Clone, Serialize)]
#[serde(untagged)]
pub(crate) enum SemanticChild {
    Text(String),
    Element(SemanticNode),
}
#[derive(Clone, Serialize)]
pub(crate) struct SemanticNode {
    pub tag: String,
    pub attrs: BTreeMap<String, String>,
    pub children: Vec<SemanticChild>,
}
#[derive(Clone, Serialize)]
pub(crate) struct Semantics {
    pub source: Option<String>,
    pub math: SemanticNode,
    pub alt: Option<String>,
    pub lang: String,
}
#[derive(Serialize)]
pub(crate) struct Glyph {
    pub key: String,
    pub commands: Vec<Command>,
}
#[derive(Serialize, PartialEq, Eq)]
pub(crate) struct FontNotice {
    pub family: String,
    pub license: String,
}
#[derive(Serialize)]
pub(crate) struct LayoutFrame {
    pub id: String,
    pub width: f64,
    pub height: f64,
    pub baseline: f64,
    pub em: f64,
    pub text: String,
    pub semantics: Semantics,
    pub items: Vec<Item>,
}
#[derive(Default, Serialize)]
pub(crate) struct Layout {
    pub glyphs: Vec<Glyph>,
    pub frames: Vec<LayoutFrame>,
    pub fonts: Vec<FontNotice>,
}

#[derive(Serialize)]
pub(crate) struct WireLayout<'a> {
    pub version: u8,
    pub compiler: &'static str,
    #[serde(flatten)]
    pub data: &'a Layout,
}
