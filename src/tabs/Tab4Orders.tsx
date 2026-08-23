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
import { Card, CardBody, CardHead, Finding, SearchField } from '../components/ui'
import OrderPanel from '../components/OrderPanel'
import { FilterPill, PillRow, StatusPill, SummaryPill } from '../components/Pill'

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

const COLUMNS = ['#', 'PO and product', 'Status', 'Cargo ready', 'Dispatch', 'Film', 'Remarks', 'Docs', '']

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
    <Card>
      <CardHead
        icon={<Package size={20} className="text-leaf" aria-hidden />}
        kicker="Order book"
        title="Still to be made"
        lede="Every Polyco order on the tracker, what stage it is at, and the documents against it."
        asAt={`Pulled from efdashboard ${whenLocal(tracker.pulled_at)}`}
        search={
          <SearchField
            value={filters.search}
            onChange={(search) => update({ ...filters, search })}
            placeholder="PO number or product"
            label="Search orders by PO number or product"
          />
        }
      />

      <CardBody flush>
        <div className="px-4 sm:px-6">
          <Finding>{finding}</Finding>

          <div className="flex flex-col gap-4">
            <PillRow label="Product">
              <FilterPill
                label="All"
                active={filters.families.length === 0}
                onClick={() => update({ ...filters, families: [] })}
              />
              {[...PRODUCT_FAMILIES, 'Other' as const].map((family) => (
                <FilterPill
                  key={family}
                  label={family}
                  count={counts.families[family] ?? 0}
                  active={filters.families.includes(family)}
                  onClick={() => update({ ...filters, families: togglePill(filters.families, family) })}
                />
              ))}
            </PillRow>

            <PillRow label="Dispatch month">
              <FilterPill
                label="All"
                active={filters.months.length === 0}
                onClick={() => update({ ...filters, months: [] })}
              />
              {months.map((month) => (
                <FilterPill
                  key={month}
                  label={monthLabel(month)}
                  count={counts.months[month] ?? 0}
                  active={filters.months.includes(month)}
                  onClick={() => update({ ...filters, months: togglePill(filters.months, month) })}
                />
              ))}
            </PillRow>

            <PillRow label="Order status">
              <FilterPill
                label="All"
                active={filters.statuses.length === 0}
                onClick={() => update({ ...filters, statuses: [] })}
              />
              {statuses.map((status) => (
                <FilterPill
                  key={status}
                  label={status}
                  count={counts.statuses[status] ?? 0}
                  active={filters.statuses.includes(status)}
                  onClick={() => update({ ...filters, statuses: togglePill(filters.statuses, status) })}
                />
              ))}
            </PillRow>

            {/* No shipping-mode row: po_data has no such column. See OPEN-QUESTIONS.md. */}

            <div className="flex flex-wrap items-center gap-2">
              <SummaryPill>{summary.visible} visible</SummaryPill>
              <SummaryPill>{summary.notDispatched} not dispatched</SummaryPill>
              <SummaryPill>{summary.dispatched} dispatched</SummaryPill>
              {anyFilter && (
                <button type="button" onClick={() => update(CLEARED)} className="btn-text no-print">
                  Clear all
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[56rem] text-table">
            <thead>
              <tr className="text-left">
                {COLUMNS.map((label, i) => (
                  <th key={i} scope="col" className="th whitespace-nowrap">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <Band label="Open and awaiting dispatch" count={groups.open.length} />
              {groups.open.map((order) => (
                <OrderRow
                  key={order.id}
                  order={order}
                  count={documentCounts[order.po_number] ?? 0}
                  onOpen={() => setOpenOrder(order)}
                />
              ))}

              <Band label="Dispatched" count={groups.dispatched.length} />
              {groups.dispatched.map((order) => (
                <OrderRow
                  key={order.id}
                  order={order}
                  count={documentCounts[order.po_number] ?? 0}
                  onOpen={() => setOpenOrder(order)}
                />
              ))}

              {visible.length === 0 && (
                <tr>
                  <td colSpan={COLUMNS.length} className="px-4 py-8 text-center text-ink-muted">
                    No orders match that combination.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardBody>

      {openOrder && (
        <OrderPanel
          order={openOrder}
          ledger={ledgerRowsFor(openOrder.po_number, ledger)}
          isAdmin={isAdmin}
          onClose={() => setOpenOrder(null)}
        />
      )}
    </Card>
  )
}

/** A group band: small bold uppercase leaf-deep text and a count. Section 3. */
function Band({ label, count }: { label: string; count: number }) {
  return (
    <tr>
      <td colSpan={COLUMNS.length} className="band-row">
        {label}
        <span className="ml-2 num font-semibold opacity-70">{count}</span>
      </td>
    </tr>
  )
}

function OrderRow({ order, count, onOpen }: { order: PoOrderT; count: number; onOpen: () => void }) {
  return (
    <tr
      onClick={onOpen}
      className="cursor-pointer border-b border-rule bg-surface align-top hover:bg-tint"
    >
      <td className="td num text-ink-muted">{order.row_no}</td>
      <td className="td">
        <span className="font-bold text-ink-strong">{order.po_number}</span>
        <span className="block text-ink">{order.product}</span>
        {/* A tiny grey uppercase tag beneath the product name for its family. */}
        <span className="mt-1 flex flex-wrap gap-2">
          {familiesFor(order.product).map((family) => (
            <span key={family} className="text-sub font-semibold uppercase tracking-wide text-ink-muted">
              {family}
            </span>
          ))}
        </span>
      </td>
      <td className="td">
        <StatusPill status={order.order_status} />
      </td>
      <td className="td whitespace-nowrap">
        {order.cargo_ready_date ? (
          dayLong(order.cargo_ready_date)
        ) : (
          <span className="text-ink-muted">{order.cargo_ready || ''}</span>
        )}
      </td>
      <td className="td whitespace-nowrap">
        {order.dispatched_date ? (
          dayLong(order.dispatched_date)
        ) : (
          <span className="text-ink-muted">{order.dispatched || 'Not dispatched'}</span>
        )}
      </td>
      <td className="td">
        {order.film}
        {order.rolls && <span className="sub block">{order.rolls}</span>}
      </td>
      <td className="td max-w-[16rem] text-ink-muted">{order.remarks}</td>
      <td className="td whitespace-nowrap text-ink-muted">
        {count > 0 ? (
          <span className="inline-flex items-center gap-1.5">
            <Paperclip size={13} aria-hidden />
            {count}
          </span>
        ) : (
          ''
        )}
      </td>
      <td className="td whitespace-nowrap font-semibold text-leaf">Open</td>
    </tr>
  )
}
