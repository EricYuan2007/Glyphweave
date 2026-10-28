/** Optional browser enhancement. Rendering and accessible MathML need no JS. */
const installed = new WeakSet<Document>()
const sourceSelector = '[data-gw-typst-source].gw-layout-source'
function sourceAt(node: Node): Element | null {
  return (node.nodeType === 1 ? node as Element : node.parentElement)?.closest(sourceSelector) ?? null
}
function plainText(node: Node): string {
  if (node.nodeType === 3) return node.textContent ?? ''
  if (!(node instanceof Element)) return Array.from(node.childNodes).map(plainText).join('')
  if (node.matches('.gw-layout-ink, .gw-layout-semantics, script, style')) return ''
  if (node.matches(sourceSelector)) return node.getAttribute('data-gw-typst-source') ?? ''
  if (node.tagName === 'BR') return '\n'
  const text = Array.from(node.childNodes).map(plainText).join('')
  return /^(P|DIV|SECTION|ARTICLE|LI|H[1-6]|PRE|BLOCKQUOTE|TR)$/.test(node.tagName) ? `${text}\n` : text
}

export function installMathCopy(doc: Document = document): void {
  if (installed.has(doc)) return
  installed.add(doc)
  const selected = new Set<Element>()
  doc.addEventListener('selectionchange', () => {
    for (const node of selected) node.classList.remove('gw-math-selected')
    selected.clear()
    const selection = doc.getSelection()
    if (!selection || selection.isCollapsed) return
    for (const node of doc.querySelectorAll(sourceSelector)) {
      if (selection.containsNode(node, true)) {
        const frame = node.parentElement!
        frame.classList.add('gw-math-selected')
        selected.add(frame)
      }
    }
  })
  doc.addEventListener('copy', event => {
    const target = event.target
    if (target instanceof Element && target.closest('input, textarea, [contenteditable="true"]')) return
    const selection = doc.getSelection()
    if (!selection || selection.isCollapsed || !event.clipboardData) return
    const ranges = Array.from({ length: selection.rangeCount }, (_, i) => selection.getRangeAt(i).cloneRange())
    if (!ranges.some(range => Array.from(doc.querySelectorAll(sourceSelector)).some(node => range.intersectsNode(node)))) return
    const texts = ranges.map(range => {
      // A formula is copied atomically, even when a browser selects only part of its overlay.
      const start = sourceAt(range.startContainer)
      const end = sourceAt(range.endContainer)
      if (start) range.setStartBefore(start.parentElement!)
      if (end) range.setEndAfter(end.parentElement!)
      return plainText(range.cloneContents()).replace(/^\n+|\n+$/g, '')
    })
    event.clipboardData.setData('text/plain', texts.join('\n'))
    event.preventDefault()
  })
}
