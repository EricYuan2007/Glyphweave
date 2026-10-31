import type { Root, Element } from 'hast'
import { codeToHast } from 'shiki'
import { propertyValue, textContent } from './tree.js'
import type { HastNode } from './types.js'

const languageAliases: Record<string, string> = {
  typ: 'typst',
  ts: 'typescript',
  js: 'javascript',
  sh: 'shellscript',
  bash: 'shellscript',
}

const languageLabels: Record<string, string> = {
  typst: 'Typst',
  typescript: 'TypeScript',
  javascript: 'JavaScript',
  shellscript: 'Shell',
  json: 'JSON',
  yaml: 'YAML',
  text: 'Text',
}

export async function highlightCodeBlocks(root: HastNode) {
  const blocks: Array<{ parent: Root | Element; index: number; code: Element }> = []

  const collect = (node: HastNode) => {
    if (!('children' in node)) return
    for (const [index, child] of node.children.entries()) {
      const code =
        child.type === 'element' && child.tagName === 'pre'
          ? child.children.find(isCode)
          : undefined
      if (code) blocks.push({ parent: node, index, code })
      else collect(child)
    }
  }
  collect(root)

  for (const block of blocks) {
    const sourceLanguage = propertyValue(block.code, 'data-lang') ?? 'text'
    const language = languageAliases[sourceLanguage] ?? sourceLanguage
    const highlighted = await highlight(textContent(block.code), language)
    block.parent.children[block.index] = createCodeBlock(
      highlighted,
      languageLabels[language] ?? language,
    )
  }
}

async function highlight(source: string, language: string): Promise<Element> {
  const root = await codeToHast(source, { lang: language, theme: 'github-light' }).catch(() =>
    codeToHast(source, { lang: 'text', theme: 'github-light' }),
  )
  const pre = root.children.find(
    (node): node is Element => node.type === 'element' && node.tagName === 'pre',
  )
  if (!pre) throw new Error('Highlighter produced no code block')
  return pre
}

function createCodeBlock(pre: Element, label: string): Element {
  pre.properties = {
    ...pre.properties,
    className: ['shiki', 'github-light', 'gw-code-pre'],
    tabIndex: 0,
  }
  delete pre.properties.class
  delete pre.properties.style
  delete pre.properties.tabindex

  pre.properties.dataLanguage = label
  return pre
}

function isCode(node: HastNode): node is Element {
  return node.type === 'element' && node.tagName === 'code'
}
