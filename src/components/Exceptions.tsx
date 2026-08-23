import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'

/**
 * Every exception on a screen, as one count that opens on demand.
 *
 * REDESIGN-2-SPEC section 9: delete every stacked note panel. Each note was
 * written to be helpful; together they buried the numbers. A count with a mark
 * says the same thing in one line and costs nothing until a reader wants it.
 */
export function Exceptions({
  items,
  label = 'open items',
}: {
  items: string[]
  label?: string
}) {
  const [open, setOpen] = useState(false)
  if (items.length === 0) return null

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 text-label text-watch hover:text-ink"
        aria-expanded={open}
      >
        <AlertTriangle size={13} aria-hidden />
        {items.length} {label}
        <span className="text-ink-50">{open ? 'Hide' : 'Show'}</span>
      </button>

      {open && (
        <ul className="mt-2 flex max-w-prose flex-col gap-1 border-l border-rule pl-2">
          {items.map((item, i) => (
            <li key={i} className="text-label text-ink-70">
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
