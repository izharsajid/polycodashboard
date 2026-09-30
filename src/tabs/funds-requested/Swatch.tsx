import type { Category } from '../../engine/classify'
import { CATEGORY_STYLE } from './categoryStyle'

/**
 * A category's colour as a small square. Hatched where the line was utilised
 * rather than requested, matching the chart, so the distinction survives in
 * greyscale and on paper.
 */
export default function Swatch({ category, hatched = false, size = 12 }: { category: Category; hatched?: boolean; size?: number }) {
  const { bg } = CATEGORY_STYLE[category]
  return (
    <span
      aria-hidden
      className={`inline-block shrink-0 ${bg} ${hatched ? 'hatch-utilised' : ''}`}
      style={{ width: size, height: size, printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}
    />
  )
}
