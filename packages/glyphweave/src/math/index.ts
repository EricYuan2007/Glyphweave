import { LayoutSchema } from './layout.js'
import { renderValidatedMath } from './render.js'
export { LayoutSchema, type MathLayout, type SemanticNode } from './layout.js'
export type { RenderedMath } from './render.js'

/** Validate external layout data, then render HAST frames and deterministic font/CSS assets. */
export function renderMathLayout(input: unknown, fontUrl: string) {
  return renderValidatedMath(LayoutSchema.parse(input), fontUrl)
}
