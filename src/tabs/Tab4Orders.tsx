import { Package, Paperclip } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { LedgerT, PoOrderT, PoTrackerT } from '../lib/schema'
import {
  NOT_DISPATCHED, PRODUCT_FAMILIES, dispatchMonths, familiesFor,
  filterOrders, groupOrders, ledgerRowsFor, orderStatuses, pillCounts, summarise,
  type PoFilters,
} from '../lib/engine/po-filter'
import { api } from '../lib/api'
import { CLEARED, readPoUrl, togglePill, writePoUrl } from '../lib/po-url'
import { whenLocal } from '../lib/format'
import { Finding, SectionHead } from '../components/ui'
import OrderPanel from '../components/OrderPanel'
import { StatusPill } from '../components/Pill'

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function monthLabel(month: string) {
  if (month === NOT_DISPATCHED) return 'Not dispatched'
  const [year, m] = month.split('-')
  return `${MONTH_NAMES[Number(m) - 1]} ${year}`
}

/** One date format in tables throughout: 28 Jul 2026. Never numeric. */
function dayLong(iso: string | null) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${Number(d)} ${MONTH_NAMES[Number(m) - 1]} ${y}`
}

function FilterPill({
  label, count, active, onClick,
}: { label: string; count?: number; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded border px-2 py-1 text-label whitespace-nowrap ${
        active
          ? 'border-accent bg-accent-soft font-semibold text-accent'
          : 'border-rule text-ink-70 hover:text-ink hover:bg-rule'
      }`}
    >
      {label}
      {count !== undefined && (
        <span className={`ml-1 num ${active ? 'text-accent' : 'text-ink-50'}`}>{count}</span>
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

  /**
   * How many documents each order carries, so a reader sees at a glance which
   * have paperwork. One request rather than one per row.
   */
  const [documentCounts, setDocumentCounts] = useState<Record<string, number>>({})
  useEffect(() => {
    let live = true
    void (async () => {
      const result = await api.get<{ counts: Record<string, number> }>('/api/orders/document-counts')
      if (live && result.ok) setDocumentCounts(result.data.counts)
    })()
    return () => {
      live = false
    }
  }, [])

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
        icon={<Package size={19} className="text-ink-50" aria-hidden />}
        kicker="Order book"
        title="Still to be made"
        lede="Every Polyco order on the tracker, what stage it is at, and the documents against it."
        asAt={`Pulled from efdashboard ${whenLocal(tracker.pulled_at)}`}
      />

      <Finding>{finding}</Finding>

      <div className="border-t border-rule pt-2 no-print">
        <div className="px-2 py-2 flex flex-col gap-2">
          <FilterRow label="Product">
            <FilterPill label="All" active={filters.families.length === 0} onClick={() => update({ ...filters, families: [] })} />
            {[...PRODUCT_FAMILIES, 'Other' as const].map((family) => (
              <FilterPill
                key={family}
                label={family}
                count={counts.families[family] ?? 0}
                active={filters.families.includes(family)}
                onClick={() => update({ ...filters, families: togglePill(filters.families, family) })}
              />
            ))}
          </FilterRow>

          <FilterRow label="Dispatch month">
            <FilterPill label="All" active={filters.months.length === 0} onClick={() => update({ ...filters, months: [] })} />
            {months.map((month) => (
              <FilterPill
                key={month}
                label={monthLabel(month)}
                count={counts.months[month] ?? 0}
                active={filters.months.includes(month)}
                onClick={() => update({ ...filters, months: togglePill(filters.months, month) })}
              />
            ))}
          </FilterRow>

          <FilterRow label="Order status">
            <FilterPill label="All" active={filters.statuses.length === 0} onClick={() => update({ ...filters, statuses: [] })} />
            {statuses.map((status) => (
              <FilterPill
                key={status}
                label={status}
                count={counts.statuses[status] ?? 0}
                active={filters.statuses.includes(status)}
                onClick={() => update({ ...filters, statuses: togglePill(filters.statuses, status) })}
              />
            ))}
          </FilterRow>

          {/* No shipping-mode row: po_data has no such column. See OPEN-QUESTIONS.md. */}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-rule pt-2">
            <p className="lede">
              {summary.visible} shown · {summary.notDispatched} not dispatched ·{' '}
              {summary.dispatched} dispatched
              {anyFilter && (
                <button
                  type="button"
                  onClick={() => update(CLEARED)}
                  className="ml-2 underline underline-offset-2 hover:text-ink"
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
              className="field w-full sm:w-72"
            />
          </div>
        </div>
      </div>

      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[52rem] text-table">
          <thead>
            <tr className="text-left bg-rule-soft">
              {['#', 'PO and product', 'Status', 'Cargo ready', 'Dispatch', 'Film', 'Remarks', 'Docs', ''].map(
                (label, i) => (
                  <th
                    key={i}
                    scope="col"
                    className="border-b border-rule px-2 py-2 text-eyebrow font-semibold uppercase text-ink-50 whitespace-nowrap"
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
              <OrderRow key={order.id} order={order} count={documentCounts[order.po_number] ?? 0} onOpen={() => setOpenOrder(order)} />
            ))}

            <Band label="Dispatched" count={groups.dispatched.length} />
            {groups.dispatched.map((order) => (
              <OrderRow key={order.id} order={order} count={documentCounts[order.po_number] ?? 0} onOpen={() => setOpenOrder(order)} />
            ))}

            {visible.length === 0 && (
              <tr>
                <td colSpan={9} className="px-2 py-4 text-center text-ink-70">
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
    <div className="flex flex-wrap items-baseline gap-1">
      <span className="eyebrow w-28 shrink-0">{label}</span>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  )
}

function Band({ label, count }: { label: string; count: number }) {
  return (
    <tr className="bg-rule-soft">
      <td colSpan={9} className="border-y border-rule px-2 py-1 text-label font-semibold text-accent">
        {label}
        <span className="ml-1 num font-normal text-ink-70">{count}</span>
      </td>
    </tr>
  )
}

function OrderRow({ order, count, onOpen }: { order: PoOrderT; count: number; onOpen: () => void }) {
  return (
    <tr
      onClick={onOpen}
      className="cursor-pointer border-b border-rule align-top hover:bg-rule"
    >
      <td className="px-2 py-2 num text-ink-50">{order.row_no}</td>
      <td className="px-2 py-2">
        <span className="font-semibold text-ink">{order.po_number}</span>
        <span className="block text-ink-70">{order.product}</span>
        <span className="mt-1 flex flex-wrap gap-1">
          {familiesFor(order.product).map((family) => (
            <span key={family} className="text-eyebrow font-semibold uppercase text-ink-50">
              {family}
            </span>
          ))}
        </span>
      </td>
      <td className="px-2 py-2"><StatusPill status={order.order_status} /></td>
      <td className="px-2 py-2 whitespace-nowrap">
        {order.cargo_ready_date ? dayLong(order.cargo_ready_date) : (
          <span className="text-ink-70">{order.cargo_ready || ''}</span>
        )}
      </td>
      <td className="px-2 py-2 whitespace-nowrap">
        {order.dispatched_date ? dayLong(order.dispatched_date) : (
          <span className="text-ink-50">{order.dispatched || 'Not dispatched'}</span>
        )}
      </td>
      <td className="px-2 py-2">
        {order.film}
        {order.rolls && <span className="block text-ink-70">{order.rolls}</span>}
      </td>
      <td className="px-2 py-2 text-ink-70 max-w-[16rem]">{order.remarks}</td>
      <td className="px-2 py-2 whitespace-nowrap text-label text-ink-50">
        {count > 0 ? (
          <span className="inline-flex items-center gap-1">
            <Paperclip size={13} aria-hidden />
            {count}
          </span>
        ) : (
          ''
        )}
      </td>
      <td className="px-2 py-2 whitespace-nowrap text-accent underline underline-offset-2">Open</td>
    </tr>
  )
}
