import { CATEGORY_LABEL, type Category } from '../engine/classify'
import { percent } from '../lib/format'
import { CATEGORY_STYLE } from './categoryStyle'

/**
 * How a month's costs split across the categories, as one rounded strip. Only
 * positive amounts take up room; a credit is shown separately where it applies.
 * A screen reader gets the split as text.
 */
export default function CategoryBar({
  groups,
  height = 8,
}: {
  groups: { category: Category; cents: number }[]
  height?: number
}) {
  const parts = groups.filter((g) => g.cents > 0)
  const total = parts.reduce((a, g) => a + g.cents, 0)
  if (total === 0) return null
  return (
    <div>
      <div className="flex w-full gap-0.5 overflow-hidden rounded-full" style={{ height }} aria-hidden>
        {parts.map((g) => (
          <span
            key={g.category}
            className={CATEGORY_STYLE[g.category].bg}
            style={{ width: `${(g.cents / total) * 100}%`, printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}
          />
        ))}
      </div>
      <p className="sr-only">
        {parts.map((g) => `${CATEGORY_LABEL[g.category]} ${percent(g.cents / total)}`).join(', ')}
      </p>
    </div>
  )
}
