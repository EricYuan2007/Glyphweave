import { visit } from 'unist-util-visit'
import { defaultSchema } from 'rehype-sanitize'
import { sanitize as sanitizeHast, type Schema } from 'hast-util-sanitize'
import type { Root } from 'hast'
import type { HastNode } from './types.js'

const mathTags =
  'math mi mn mo ms mtext mrow mfrac msqrt mroot mstyle merror mpadded mphantom mfenced menclose msub msup msubsup munder mover munderover mmultiscripts mprescripts none mtable mtr mtd maligngroup malignmark semantics annotation'.split(
    ' ',
  )
const svgTags =
  'svg g path defs use symbol clipPath rect circle ellipse line polyline polygon title desc'.split(
    ' ',
  )
const schema: Schema = {
  ...defaultSchema,
  clobberPrefix: '', // IDs and references are normalized together by the heading pass.
  tagNames: [
    ...new Set([
      ...(defaultSchema.tagNames ?? []),
      ...mathTags,
      ...svgTags,
      'section',
      'footer',
      'figure',
      'figcaption',
    ]),
  ],
  attributes: {
    ...defaultSchema.attributes,
    '*': [
      ...(defaultSchema.attributes?.['*'] ?? []),
      'className',
      'role',
      'ariaLabel',
      'ariaHidden',
      'ariaDescribedBy',
      'ariaLabelledBy',
      'dataGwMath',
      'dataGwRenderer',
      'dataGwSource',
      'dataLang',
      'data-gw-math',
      'data-gw-renderer',
      'data-gw-source',
      'data-lang',
    ],
    a: [...(defaultSchema.attributes?.a ?? []), 'href', 'rel'],
    img: [...(defaultSchema.attributes?.img ?? []), 'srcSet'],
    span: [
      'className',
      'style',
      'dataGwMath',
      'dataGwRenderer',
      'dataGwSource',
      'data-gw-math',
      'data-gw-renderer',
      'data-gw-source',
      'ariaLabel',
    ],
    ...Object.fromEntries(
      mathTags.map((tag) => [
        tag,
        [
          'className',
          'display',
          'mathVariant',
          'mathSize',
          'stretchy',
          'fence',
          'separator',
          'accent',
          'accentunder',
          'columnAlign',
          'rowAlign',
          'columnSpacing',
          'rowSpacing',
          'columnLines',
          'rowLines',
          'columnSpan',
          'rowSpan',
          'linethickness',
          'lspace',
          'rspace',
          'minsize',
          'maxsize',
          'displaystyle',
          'scriptlevel',
          'encoding',
        ],
      ]),
    ),
    ...Object.fromEntries(
      svgTags.map((tag) => [
        tag,
        [
          'id',
          'className',
          'viewBox',
          'width',
          'height',
          'x',
          'y',
          'x1',
          'x2',
          'y1',
          'y2',
          'cx',
          'cy',
          'r',
          'rx',
          'ry',
          'd',
          'points',
          'fill',
          'fillRule',
          'stroke',
          'strokeWidth',
          'strokeLinecap',
          'strokeLinejoin',
          'strokeMiterlimit',
          'transform',
          'clipPath',
          'clipRule',
          'href',
          'xLinkHref',
          'xmlns',
          'style',
        ],
      ]),
    ),
  },
  protocols: {
    ...defaultSchema.protocols,
    href: ['http', 'https', 'mailto'],
    src: ['http', 'https'],
    xLinkHref: [],
  },
}

export function isExternalUrl(value: string) {
  return /^(?:https?:)?\/\//i.test(value)
}

/** Normalize ASCII controls before protocol checks, as browser URL parsers do. */
export function isUnsafeProtocol(value: string) {
  // Browser URL parsing removes ASCII controls, including tabs inside the scheme.
  const normalized = [...value]
    .filter((char) => char.charCodeAt(0) > 32 && char.charCodeAt(0) !== 127)
    .join('')
  const protocol = normalized.match(/^([a-z][a-z0-9+.-]*):/i)?.[1]?.toLowerCase()
  return protocol !== undefined && !['http', 'https', 'mailto'].includes(protocol)
}

export function assertNoUnsafeProtocols(value: string) {
  if (isUnsafeProtocol(value)) throw new Error(`Unsafe URL protocol detected: ${value}`)
}

export function assertNoLocalAbsolutePaths(value: string) {
  if (/^(?:\/(?:Users|home|private|tmp|etc|var)\/|~\/|file:|[A-Za-z]:[\\/])/i.test(value.trim()))
    throw new Error(`Local absolute path detected: ${value}`)
}

export function rewriteLinks(root: HastNode) {
  visit(root as Root, 'element', (node) => {
    if (node.tagName !== 'a' || typeof node.properties.href !== 'string') return
    const href = node.properties.href
    assertNoLocalAbsolutePaths(href)
    if (isUnsafeProtocol(href)) delete node.properties.href
    else if (isExternalUrl(href)) node.properties.rel = ['noopener', 'noreferrer']
  })
}

/** Allow only fixed numeric layout styles needed by Typst; author CSS never passes through. */
function safeStyle(value: string, tag: string) {
  return value
    .split(';')
    .map((entry) => entry.trim())
    .filter((entry) => {
      if (tag === 'span')
        return /^--gw-math-inline-shift:\s*[+-]?(?:\d+|\d*\.\d+)(?:em|rem|px|%)$/.test(entry)
      return (
        tag === 'svg' &&
        /^(?:(?:width|height):\s*\d+(?:\.\d+)?(?:em|rem|px|pt|%)|overflow:\s*(?:visible|hidden))$/.test(
          entry,
        )
      )
    })
    .join('; ')
}

/** Sanitize HTML, MathML and the small static SVG subset emitted by Typst. */
export function sanitize(root: HastNode) {
  visit(root as Root, 'element', (node) => {
    for (const [key, value] of Object.entries(node.properties)) {
      if (key === 'name') {
        delete node.properties[key]
        continue
      }
      if (typeof value !== 'string') continue
      if (['href', 'src', 'poster', 'xLinkHref'].includes(key)) {
        assertNoLocalAbsolutePaths(value)
        if (isUnsafeProtocol(value) || (svgTags.includes(node.tagName) && !value.startsWith('#')))
          delete node.properties[key]
      }
      if (
        key === 'srcSet' &&
        value.split(',').some((entry) => isUnsafeProtocol(entry.trim().split(/\s+/)[0]))
      )
        delete node.properties[key]
      if (key === 'style') node.properties[key] = safeStyle(value, node.tagName)
      if (
        ['fill', 'stroke', 'clipPath'].includes(key) &&
        /url\(/i.test(value) &&
        !/^url\(#[a-zA-Z0-9_-]+\)$/.test(value)
      )
        delete node.properties[key]
    }
  })
  const clean = sanitizeHast(root as Root, schema)
  Object.assign(root, clean)
}
