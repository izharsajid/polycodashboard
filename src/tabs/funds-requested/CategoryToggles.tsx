import { RotateCcw } from 'lucide-react'
import { CATEGORIES, CATEGORY_LABEL, type Category } from '../../engine/classify'
import { CATEGORY_STYLE } from './categoryStyle'

/**
 * The legend is the control. Each category is a toggle: switch one off and the
 * chart recomposes around what is left. The last one cannot be switched off.
 */
type Props = {
  active: ReadonlySet<Category>
  onToggle: (c: Category) => void
  onShowAll: () => void
}

export default function CategoryToggles({ active, onToggle, onShowAll }: Props) {
  const all = active.size === CATEGORIES.length
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Categories in the chart">
      {CATEGORIES.map((c) => {
        const on = active.has(c)
        const { bg, border, Icon } = CATEGORY_STYLE[c]
        return (
          <button
            key={c}
            type="button"
            aria-pressed={on}
            onClick={() => onToggle(c)}
            className={`inline-flex min-h-[40px] items-center gap-2 border px-2.5 text-table ${
              on ? 'border-press bg-sheet font-semibold text-press' : 'border-rule bg-zinc text-press-2'
            }`}
          >
            <span aria-hidden className={`inline-block h-3.5 w-3.5 border-2 ${border} ${on ? bg : 'bg-sheet'}`} />
            <Icon size={15} aria-hidden />
            {CATEGORY_LABEL[c]}
          </button>
        )
      })}
      {!all && (
        <button type="button" onClick={onShowAll} className="btn-text min-h-[40px] px-1">
          <RotateCcw size={14} aria-hidden />
          Show all
        </button>
      )}
    </div>
  )
}
