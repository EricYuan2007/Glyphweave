use crate::frame::{attribute, find_element};
use typst::syntax::{Span, SyntaxKind};
use typst_html::{HtmlAttr, HtmlElement, HtmlNode};
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
pub(crate) fn capture_sources(elem: &mut HtmlElement, world: &dyn typst::World) {
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
