import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'

/**
 * Every exception on a screen, as one count that opens on demand.
 *
 * REDESIGN-2-SPEC section 9: delete every stacked note panel. Each note was
 * written to be helpful; together they buried the numbers. A count with a mark
 * says the same thing in one line and costs nothing until a reader wants it.
 */
export function Exceptions({ items, label = 'open items' }: { items: string[]; label?: string }) {
  const [open, setOpen] = useState(false)
  if (items.length === 0) return null

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-full bg-watch-wash px-3 py-1 text-sub font-semibold text-watch"
        aria-expanded={open}
      >
        <AlertTriangle size={12} aria-hidden />
        {items.length} {label}
        <span className="font-normal opacity-70">{open ? 'Hide' : 'Show'}</span>
      </button>

      {open && (
        <ul className="mt-3 flex max-w-prose flex-col gap-2 border-l-2 border-rule pl-3">
          {items.map((item, i) => (
            <li key={i} className="text-table text-ink">
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
