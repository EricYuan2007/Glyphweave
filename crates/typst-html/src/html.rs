use typst_html::{HtmlElement, HtmlNode};

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
