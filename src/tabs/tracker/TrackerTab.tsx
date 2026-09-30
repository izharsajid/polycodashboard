import { RefreshCw, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTracker } from '../../data/useTracker'
import { filterPills, filterTracker, groupTracker, NO_FILTERS, type Pill, type TrackerFilters } from '../../engine/tracker'
import PoCard from './PoCard'

/**
 * Tab 3, PO tracker. efdashboard.com's tracker, read live and shown with its
 * own filters, counts, groups and files. efdashboard.com stays the master: this
 * tab never edits an order.
 */
const monthLabel = (key: string) =>
  new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${key}-01T00:00:00Z`))

export default function TrackerTab() {
  const { tracker, error, loading } = useTracker()
  const [f, setF] = useState<TrackerFilters>(NO_FILTERS)

  const view = useMemo(() => {
    if (!tracker) return null
    const pills = filterPills(tracker, f)
    const rows = filterTracker(tracker, f)
    return { pills, rows, groups: groupTracker(rows) }
  }, [tracker, f])

  if (loading) return <p className="mt-8 text-body text-press-2" aria-busy="true">Reading efdashboard.com.</p>
  if (error || !tracker || !view) {
    return (
      <p role="alert" className="mt-8 max-w-prose rounded-card border-l-3 border-alert bg-sheet py-3 pl-4 pr-4 text-body text-alert">
        {error ?? 'The PO tracker could not be read.'}
      </p>
    )
  }

  const open = view.rows.filter((p) => !p.isDispatched && !p.isInactive).length
  const dispatched = view.rows.filter((p) => p.isDispatched).length
  const inactive = view.rows.filter((p) => p.isInactive && !p.isDispatched).length

  return (
    <div className="space-y-6 pt-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="condensed text-figure font-bold">PO tracker</h1>
          <p className="mt-1 max-w-prose text-table text-press-2">
            Live from efdashboard.com, the master record for orders and dispatches.
            {tracker.updated && <> Last updated {tracker.updated}.</>}
          </p>
        </div>
        <label className="relative w-full max-w-xs">
          <span className="sr-only">Search orders</span>
          <Search size={16} aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2 text-press-2" />
          <input
            type="search"
            value={f.search}
            onChange={(e) => setF({ ...f, search: e.target.value })}
            placeholder="Search PO or product"
            className="field rounded-full pl-9"
          />
        </label>
      </header>

      <div className="space-y-3 rounded-card bg-sheet p-4 shadow-card">
        <PillRow label="Product" pills={view.pills.products} value={f.product} onPick={(product) => setF({ ...f, product })} />
        <PillRow
          label="Dispatch month"
          pills={view.pills.months.map((p) => (/^\d{4}-\d{2}$/.test(p.value) ? { ...p, label: monthLabel(p.value) } : p))}
          value={f.month}
          onPick={(month) => setF({ ...f, month })}
        />
        <PillRow label="Order status" pills={view.pills.statuses} value={f.status} onPick={(status) => setF({ ...f, status })} />
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-rule pt-3 text-table">
          <p>
            <strong>{view.rows.length}</strong> visible · <strong>{open}</strong> not dispatched · <strong>{dispatched}</strong> dispatched
            {f.showInactive && <> · <strong>{inactive}</strong> inactive</>}
          </p>
          <button
            type="button"
            aria-pressed={f.showInactive}
            onClick={() => setF(f.showInactive ? { ...f, showInactive: false } : { ...NO_FILTERS, showInactive: true, include2025: f.include2025 })}
            className={`btn-secondary min-h-[36px] ${f.showInactive ? 'border-press' : ''}`}
          >
            {f.showInactive ? 'Hide inactive POs' : 'Show inactive POs'}
          </button>
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={f.include2025}
              onChange={(e) => setF({ ...f, include2025: e.target.checked, month: 'all' })}
              className="h-4 w-4"
            />
            Include dispatches in 2025
          </label>
          {f !== NO_FILTERS && (
            <button type="button" className="btn-text" onClick={() => setF(NO_FILTERS)}>
              <RefreshCw size={14} aria-hidden /> Clear filters
            </button>
          )}
        </div>
      </div>

      {view.rows.length === 0 && <p className="text-body text-press-2">No purchase orders match these filters.</p>}

      {view.groups.map((g) => (
        <section key={g.label} aria-labelledby={`group-${g.label}`}>
          <h2 id={`group-${g.label}`} className="condensed mb-3 text-title font-bold text-press-2">
            {g.label} · {g.rows.length}
          </h2>
          <ul className="space-y-3">
            {g.rows.map((p) => (
              <li key={p.id}>
                <PoCard p={p} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

function PillRow({ label, pills, value, onPick }: { label: string; pills: Pill[]; value: string; onPick: (v: string) => void }) {
  return (
    <div role="group" aria-label={label}>
      <p className="mb-1.5 text-small font-semibold text-press-2">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {pills.map((p) => {
          const active = p.value === value
          return (
            <button
              key={p.value}
              type="button"
              aria-pressed={active}
              onClick={() => onPick(p.value)}
              className={`inline-flex min-h-[34px] items-center gap-1.5 rounded-full border px-3 text-table font-semibold ${
                active ? 'border-press bg-press text-sheet' : 'border-rule bg-sheet text-press hover:border-press-2'
              }`}
            >
              {p.label}
              <span className={`rounded-full px-1.5 text-small ${active ? 'bg-sheet/20' : 'bg-mist text-press-2'}`}>{p.count}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
