import { codeToHast } from 'shiki'
import { propertyValue, rawTextContent } from './tree.js'
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
  const blocks: Array<{ parent: HastNode; index: number; code: HastNode }> = []

  const collect = (node: HastNode) => {
    for (const [index, child] of (node.children ?? []).entries()) {
      const code = child.tagName === 'pre' ? child.children?.find(isCode) : undefined
      if (code) blocks.push({ parent: node, index, code })
      else collect(child)
    }
  }
  collect(root)

  for (const block of blocks) {
    const sourceLanguage = propertyValue(block.code, 'data-lang') ?? 'text'
    const language = languageAliases[sourceLanguage] ?? sourceLanguage
    const highlighted = await highlight(rawTextContent(block.code), language)
    block.parent.children![block.index] = createCodeBlock(
      highlighted,
      languageLabels[language] ?? language,
    )
  }
}

async function highlight(source: string, language: string): Promise<HastNode> {
  try {
    const root = await codeToHast(source, { lang: language, theme: 'github-light' })
    return root.children[0] as HastNode
  } catch {
    const root = await codeToHast(source, { lang: 'text', theme: 'github-light' })
    return root.children[0] as HastNode
  }
}

function createCodeBlock(pre: HastNode, label: string): HastNode {
  pre.properties = {
    ...pre.properties,
    className: ['shiki', 'github-light', 'gw-code-pre'],
    tabIndex: 0,
  }
  delete pre.properties.class
  delete pre.properties.style
  delete pre.properties.tabindex

  return {
    type: 'element',
    tagName: 'div',
    properties: { className: ['gw-code-block'], 'data-code-language': label },
    children: [
      {
        type: 'element',
        tagName: 'div',
        properties: { className: ['gw-code-toolbar'] },
        children: [
          {
            type: 'element',
            tagName: 'span',
            properties: { className: ['gw-code-language'] },
            children: [{ type: 'text', value: label }],
          },
          {
            type: 'element',
            tagName: 'button',
            properties: {
              type: 'button',
              className: ['gw-code-copy'],
              'data-copy-code': '',
              ariaLabel: 'Copy code',
            },
            children: [{ type: 'text', value: 'Copy' }],
          },
        ],
      },
      pre,
    ],
  }
}

function isCode(node: HastNode) {
  return node.type === 'element' && node.tagName === 'code'
}
