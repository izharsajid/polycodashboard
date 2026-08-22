import { useCallback, useEffect, useMemo, useState } from 'react'
import type { LedgerT, PoOrderT, PoTrackerT } from '../lib/schema'
import {
  NOT_DISPATCHED, PRODUCT_FAMILIES, dispatchMonths, familiesFor,
  filterOrders, groupOrders, ledgerRowsFor, orderStatuses, pillCounts, summarise,
  type PoFilters,
} from '../lib/engine/po-filter'
import { CLEARED, readPoUrl, togglePill, writePoUrl } from '../lib/po-url'
import { whenLocal } from '../lib/format'
import { Finding, SectionHead } from '../components/ui'
import OrderPanel from '../components/OrderPanel'

/** The state palette from DESIGN.md. No colour is invented for a status. */
const STATUS_TONE: Record<string, string> = {
  Dispatched: 'bg-state-good-wash text-state-good',
  Booked: 'bg-state-plan-wash text-state-plan',
  Processing: 'bg-state-info-wash text-state-info',
  Cancelled: 'bg-state-off-wash text-state-off',
}
const DEFAULT_TONE = 'bg-state-watch-wash text-state-watch'

function monthLabel(month: string) {
  if (month === NOT_DISPATCHED) return 'Not dispatched'
  const [year, m] = month.split('-')
  const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${names[Number(m) - 1]} ${year}`
}

function dayLong(iso: string | null) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${Number(d)} ${names[Number(m) - 1]} ${y}`
}

export function StatusPill({ status }: { status: string }) {
  if (!status) return <span className="text-ink-faint">Not set</span>
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-2 py-[3px] text-[11px] font-extrabold ${
        STATUS_TONE[status] ?? DEFAULT_TONE
      }`}
    >
      {status}
    </span>
  )
}

function Pill({
  label, count, active, onClick,
}: { label: string; count?: number; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-2.5 py-1 text-[12px] whitespace-nowrap ${
        active
          ? 'border-leaf bg-leaf-wash font-bold text-leaf-deep'
          : 'border-rule-field text-ink-muted hover:text-ink hover:bg-paper-panel'
      }`}
    >
      {label}
      {count !== undefined && (
        <span className={`ml-1.5 num ${active ? 'text-leaf-deep' : 'text-ink-faint'}`}>{count}</span>
      )}
    </button>
  )
}

export default function Tab4Orders({
  tracker, ledger, isAdmin,
}: {
  tracker: PoTrackerT
  ledger: LedgerT
  isAdmin: boolean
}) {
  const [filters, setFilters] = useState<PoFilters>(() => readPoUrl(window.location.search))
  const [openOrder, setOpenOrder] = useState<PoOrderT | null>(null)

  const update = useCallback((next: PoFilters) => {
    setFilters(next)
    window.history.replaceState({}, '', `${window.location.pathname}${writePoUrl(next)}`)
  }, [])

  const orders = tracker.orders
  const visible = useMemo(() => filterOrders(orders, filters), [orders, filters])
  const counts = useMemo(() => pillCounts(orders, filters), [orders, filters])
  const groups = useMemo(() => groupOrders(visible), [visible])
  const summary = summarise(visible)
  const months = useMemo(() => dispatchMonths(orders), [orders])
  const statuses = useMemo(() => orderStatuses(orders), [orders])

  // Escape closes the panel, which is what a keyboard expects of one.
  useEffect(() => {
    if (!openOrder) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenOrder(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openOrder])

  const anyFilter =
    filters.families.length > 0 || filters.months.length > 0 || filters.statuses.length > 0 ||
    filters.search.trim() !== ''

  const finding =
    `${summary.visible} orders on the tracker, ${summary.notDispatched} still to go and ` +
    `${summary.dispatched} dispatched.`

  return (
    <section>
      <SectionHead
        kicker="Order book"
        title="Still to be made"
        lede="Every Polyco order on the tracker, what stage it is at, and the documents against it."
        asAt={`Pulled from efdashboard ${whenLocal(tracker.pulled_at)}`}
      />

      <Finding>{finding}</Finding>

      <div className="card no-print">
        <div className="px-card py-4 flex flex-col gap-3">
          <FilterRow label="Product">
            <Pill label="All" active={filters.families.length === 0} onClick={() => update({ ...filters, families: [] })} />
            {[...PRODUCT_FAMILIES, 'Other' as const].map((family) => (
              <Pill
                key={family}
                label={family}
                count={counts.families[family] ?? 0}
                active={filters.families.includes(family)}
                onClick={() => update({ ...filters, families: togglePill(filters.families, family) })}
              />
            ))}
          </FilterRow>

          <FilterRow label="Dispatch month">
            <Pill label="All" active={filters.months.length === 0} onClick={() => update({ ...filters, months: [] })} />
            {months.map((month) => (
              <Pill
                key={month}
                label={monthLabel(month)}
                count={counts.months[month] ?? 0}
                active={filters.months.includes(month)}
                onClick={() => update({ ...filters, months: togglePill(filters.months, month) })}
              />
            ))}
          </FilterRow>

          <FilterRow label="Order status">
            <Pill label="All" active={filters.statuses.length === 0} onClick={() => update({ ...filters, statuses: [] })} />
            {statuses.map((status) => (
              <Pill
                key={status}
                label={status}
                count={counts.statuses[status] ?? 0}
                active={filters.statuses.includes(status)}
                onClick={() => update({ ...filters, statuses: togglePill(filters.statuses, status) })}
              />
            ))}
          </FilterRow>

          {/* No shipping-mode row: po_data has no such column. See OPEN-QUESTIONS.md. */}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-rule pt-3">
            <p className="lede">
              {summary.visible} shown · {summary.notDispatched} not dispatched ·{' '}
              {summary.dispatched} dispatched
              {anyFilter && (
                <button
                  type="button"
                  onClick={() => update(CLEARED)}
                  className="ml-3 underline underline-offset-2 hover:text-ink"
                >
                  Clear all
                </button>
              )}
            </p>
            <input
              type="search"
              value={filters.search}
              onChange={(e) => update({ ...filters, search: e.target.value })}
              placeholder="Search PO number or product"
              className="rulebox rounded-field px-3 py-1.5 text-[13px] w-full sm:w-72"
            />
          </div>
        </div>
      </div>

      <div className="card mt-card-gap overflow-x-auto">
        <table className="w-full min-w-[52rem] text-table-cell">
          <thead>
            <tr className="text-left bg-paper-panel">
              {['#', 'PO and product', 'Status', 'Cargo ready', 'Dispatch', 'Film', 'Remarks', ''].map(
                (label, i) => (
                  <th
                    key={i}
                    scope="col"
                    className="border-b border-rule px-3 py-2.5 text-table-head font-extrabold uppercase text-ink-table whitespace-nowrap"
                  >
                    {label}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            <Band label="Open and awaiting dispatch" count={groups.open.length} />
            {groups.open.map((order) => (
              <OrderRow key={order.id} order={order} onOpen={() => setOpenOrder(order)} />
            ))}

            <Band label="Dispatched" count={groups.dispatched.length} />
            {groups.dispatched.map((order) => (
              <OrderRow key={order.id} order={order} onOpen={() => setOpenOrder(order)} />
            ))}

            {visible.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-ink-muted">
                  No orders match that combination.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {openOrder && (
        <OrderPanel
          order={openOrder}
          ledger={ledgerRowsFor(openOrder.po_number, ledger)}
          isAdmin={isAdmin}
          onClose={() => setOpenOrder(null)}
        />
      )}
    </section>
  )
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline gap-2">
      <span className="eyebrow w-28 shrink-0">{label}</span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  )
}

function Band({ label, count }: { label: string; count: number }) {
  return (
    <tr className="bg-paper-panel">
      <td colSpan={8} className="border-y border-rule px-3 py-2 text-[13px] font-bold text-leaf-deep">
        {label}
        <span className="ml-2 num font-normal text-ink-muted">{count}</span>
      </td>
    </tr>
  )
}

function OrderRow({ order, onOpen }: { order: PoOrderT; onOpen: () => void }) {
  return (
    <tr
      onClick={onOpen}
      className="cursor-pointer border-b border-rule-soft align-top hover:bg-paper-panel"
    >
      <td className="px-3 py-2.5 num text-ink-faint">{order.row_no}</td>
      <td className="px-3 py-2.5">
        <span className="font-bold text-ink-strong">{order.po_number}</span>
        <span className="block text-ink-muted">{order.product}</span>
        <span className="mt-0.5 flex flex-wrap gap-1">
          {familiesFor(order.product).map((family) => (
            <span key={family} className="text-[10px] font-extrabold uppercase text-leaf-kicker">
              {family}
            </span>
          ))}
        </span>
      </td>
      <td className="px-3 py-2.5"><StatusPill status={order.order_status} /></td>
      <td className="px-3 py-2.5 whitespace-nowrap">
        {order.cargo_ready_date ? dayLong(order.cargo_ready_date) : (
          <span className="text-ink-muted">{order.cargo_ready || ''}</span>
        )}
      </td>
      <td className="px-3 py-2.5 whitespace-nowrap">
        {order.dispatched_date ? dayLong(order.dispatched_date) : (
          <span className="text-ink-faint">{order.dispatched || 'Not dispatched'}</span>
        )}
      </td>
      <td className="px-3 py-2.5">
        {order.film}
        {order.rolls && <span className="block text-ink-muted">{order.rolls}</span>}
      </td>
      <td className="px-3 py-2.5 text-ink-muted max-w-[16rem]">{order.remarks}</td>
      <td className="px-3 py-2.5 whitespace-nowrap text-leaf underline underline-offset-2">Open</td>
    </tr>
  )
}
