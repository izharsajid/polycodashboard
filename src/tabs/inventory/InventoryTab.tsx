import { AlertTriangle, Boxes, CalendarClock, PackageCheck, Truck } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useApiData } from '../../data/useApiData'
import { buildInventory, InventoryPayload, type Item } from '../../engine/inventory'
import { quantity } from '../../lib/format'

/**
 * The stock of materials, live from efdashboard.com: fiber, lamination film and
 * others, each against its minimum, with its average daily use and the days of
 * stock that leaves.
 */
export default function InventoryTab() {
  const state = useApiData('/api/inventory', InventoryPayload, 'inventory')
  const inv = useMemo(() => (state.status === 'ready' ? buildInventory(state.data) : null), [state])
  const [section, setSection] = useState<string>('all')

  if (state.status === 'loading') return <p className="mt-8 text-body text-press-2" aria-busy="true">Loading the inventory.</p>
  if (state.status === 'failed' || !inv) {
    return (
      <p role="alert" className="mt-8 max-w-prose rounded-card border-l-3 border-alert bg-sheet py-3 pl-4 pr-4 text-body text-alert">
        {state.status === 'failed' ? state.error : 'The inventory could not be read.'}
      </p>
    )
  }

  const below = inv.items.filter((i) => i.belowMin)
  const shown = inv.sections.filter((s) => section === 'all' || s.key === section)

  return (
    <div className="space-y-8 pt-6">
      <header>
        <h1 className="condensed text-figure font-bold">Inventory</h1>
        <p className="mt-1 max-w-prose text-table text-press-2">
          The stock of materials{inv.asOf ? ` as counted on ${inv.asOf}` : ''}, live from efdashboard.com. Days left is the
          stock divided by the average daily use.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat Icon={Boxes} label="Materials" value={String(inv.items.length)} />
        <Stat
          Icon={AlertTriangle}
          label="Below their minimum"
          value={String(below.length)}
          note={below.map((i) => i.item).join(', ')}
          tone={below.length ? 'caution' : 'plain'}
        />
        <Stat
          Icon={CalendarClock}
          label="Runs out first"
          value={inv.shortest ? `${quantity(inv.shortest.daysLeft!)} days` : 'None in use'}
          note={inv.shortest?.item}
        />
      </div>

      <div role="group" aria-label="Materials" className="flex flex-wrap gap-1.5">
        {[{ key: 'all', title: 'All' }, ...inv.sections].map((s) => (
          <button
            key={s.key}
            type="button"
            aria-pressed={section === s.key}
            onClick={() => setSection(s.key)}
            className={`min-h-[40px] rounded-full border px-4 text-table font-semibold ${section === s.key ? 'border-press bg-press text-sheet' : 'border-rule bg-sheet hover:border-press-2'}`}
          >
            {s.title}
          </button>
        ))}
      </div>

      {shown.map((s) => (
        <section key={s.key} aria-labelledby={`inv-${s.key}`}>
          <h2 id={`inv-${s.key}`} className="text-title font-bold">
            {s.title} <span className="text-small font-normal text-press-2">{s.items.length} materials</span>
          </h2>
          <ul className="mt-3 grid items-start gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {s.items.map((i) => (
              <li key={i.id}>
                <Material item={i} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

function Stat({
  Icon,
  label,
  value,
  note,
  tone = 'plain',
}: {
  Icon: typeof Boxes
  label: string
  value: string
  note?: string
  tone?: 'plain' | 'caution'
}) {
  return (
    <div className={`rounded-card p-4 shadow-card ${tone === 'caution' ? 'bg-caution-wash text-caution' : 'bg-sheet'}`}>
      <p className="flex items-center gap-1.5 text-small opacity-80">
        <Icon size={14} aria-hidden /> {label}
      </p>
      <p className="num mt-1 text-title font-bold">{value}</p>
      {note && <p className="mt-0.5 text-small opacity-80">{note}</p>}
    </div>
  )
}

/** One material: its stock against its minimum, its daily use, days left, and anything on order. */
function Material({ item: i }: { item: Item }) {
  // The bar's full width is twice the minimum, or the stock if more, so the
  // minimum always sits at a readable place on it.
  const scale = Math.max(i.stock, i.min * 2, 1)
  const fill = Math.min(100, (i.stock / scale) * 100)
  const minAt = (i.min / scale) * 100
  return (
    <article className="rounded-card border border-rule bg-sheet p-4 shadow-card">
      <header className="flex items-start justify-between gap-2">
        <h3 className="text-table font-bold">{i.item}</h3>
        {i.belowMin ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-caution-wash px-2.5 py-1 text-small font-semibold text-caution">
            <AlertTriangle size={13} strokeWidth={2.5} aria-hidden /> Below minimum
          </span>
        ) : (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-income-wash px-2.5 py-1 text-small font-semibold text-income">
            <PackageCheck size={13} strokeWidth={2.5} aria-hidden /> In stock
          </span>
        )}
      </header>
      <p className="mt-2">
        <span className="num text-figure font-bold">{quantity(i.stock, 3)}</span>{' '}
        <span className="text-table text-press-2">{i.unit}</span>
      </p>
      <div className="relative mt-2 h-2.5 rounded-full bg-mist" aria-hidden>
        <span
          className={`absolute inset-y-0 left-0 rounded-full ${i.belowMin ? 'bg-caution' : 'bg-income'}`}
          style={{ width: `${fill}%`, printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}
        />
        <span className="absolute -inset-y-1 w-0.5 rounded bg-press" style={{ left: `${minAt}%` }} />
      </div>
      <p className="mt-1 text-small text-press-2">
        Minimum {quantity(i.min, 3)} {i.unit}
      </p>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-small">
        <div>
          <dt className="text-press-2">Daily use</dt>
          <dd className="font-semibold">{i.dailyUse ? `${quantity(i.dailyUse, 3)} ${i.unit} a day` : 'Not in use'}</dd>
        </div>
        <div>
          <dt className="text-press-2">Days left</dt>
          <dd className="font-semibold">{i.daysLeft !== null ? `${quantity(i.daysLeft)} days` : 'No daily use'}</dd>
        </div>
      </dl>
      {(i.ordered > 0 || i.eta) && (
        <p className="mt-3 flex items-center gap-1.5 rounded bg-info-wash px-2.5 py-1.5 text-small font-semibold text-info">
          <Truck size={14} aria-hidden />
          {i.ordered > 0 ? `${quantity(i.ordered, 3)} ${i.unit} on order` : 'On order'}
          {i.eta ? `, due ${/^\d+$/.test(i.eta) ? `in ${i.eta} days` : i.eta}` : ''}
        </p>
      )}
    </article>
  )
}
