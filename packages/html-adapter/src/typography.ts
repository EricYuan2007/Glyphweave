import type { HastNode } from './types.js'

function isWhitespace(node: HastNode): boolean {
  return node.type === 'text' && !(node.value ?? '').trim()
}

export function normalizeQuoteAttributions(root: HastNode): void {
  const children = root.children ?? []

  for (let index = 0; index < children.length; index += 1) {
    const quote = children[index]
    if (quote.tagName !== 'blockquote') continue

    let attributionIndex = index + 1
    while (attributionIndex < children.length && isWhitespace(children[attributionIndex])) {
      attributionIndex += 1
    }

    const attribution = children[attributionIndex]
    if (attribution?.tagName !== 'p') continue
    const firstText = attribution.children?.find((child) => child.type === 'text')?.value?.trimStart()
    if (!firstText?.startsWith('—')) continue

    quote.children ??= []
    quote.children.push({
      type: 'element',
      tagName: 'footer',
      properties: { className: ['gw-quote-attribution'] },
      children: attribution.children ?? [],
    })
    children.splice(attributionIndex, 1)
  }
}
