import type { LedgerRowT, LedgerT, PoOrderT } from '../schema'

/**
 * Filtering the order tracker. PO-TRACKER-SPEC section 6: a pure function here,
 * tested, not logic inside a component.
 */
export const PRODUCT_FAMILIES = [
  'Oasis', 'PointFive', 'Destiny', 'Platinum', 'Cygnus', 'NWF', 'Aspen',
] as const

export type ProductFamily = (typeof PRODUCT_FAMILIES)[number] | 'Other'

/**
 * Which families a product belongs to, from the text the order already carries.
 *
 * An order can belong to more than one, and that is not a fault. "Aspen Oasis
 * Endoscopy Tray" is an Oasis tray for Aspen, so it appears under both, and a
 * count means "orders carrying this tag" rather than a share of a total. Forcing
 * one tag per order would mean choosing between the customer and the product
 * line, and the source gives no basis for that choice.
 *
 * `Northwest Frozen` is treated as NWF: the abbreviation already appears in
 * product codes like `TFNWF/MEAL` on the same kind of order.
 */
const FAMILY_PATTERNS: [Exclude<ProductFamily, 'Other'>, RegExp][] = [
  ['Oasis', /oasis/i],
  ['PointFive', /point\s*five/i],
  ['Destiny', /destiny/i],
  ['Platinum', /platinum/i],
  ['Cygnus', /cygnus/i],
  ['NWF', /nwf|northwest\s+frozen/i],
  ['Aspen', /aspen/i],
]

export function familiesFor(product: string): ProductFamily[] {
  const found = FAMILY_PATTERNS.filter(([, pattern]) => pattern.test(product)).map(([name]) => name)
  return found.length > 0 ? found : ['Other']
}

/** The bucket an order falls in on the dispatch-month row. */
export const NOT_DISPATCHED = 'not-dispatched'

export function dispatchMonthOf(order: PoOrderT): string {
  return order.dispatched_date ? order.dispatched_date.slice(0, 7) : NOT_DISPATCHED
}

/** Every month carrying an order, newest first, with the undispatched bucket ahead of them. */
export function dispatchMonths(orders: PoOrderT[]): string[] {
  const months = [...new Set(orders.map(dispatchMonthOf))].filter((m) => m !== NOT_DISPATCHED)
  months.sort().reverse()
  return orders.some((o) => dispatchMonthOf(o) === NOT_DISPATCHED)
    ? [NOT_DISPATCHED, ...months]
    : months
}

/** Every status the data actually holds, not every status the spec imagined. */
export function orderStatuses(orders: PoOrderT[]): string[] {
  return [...new Set(orders.map((o) => o.order_status.trim()).filter(Boolean))].sort()
}

export type PoFilters = {
  families: ProductFamily[]
  months: string[]
  statuses: string[]
  search: string
}

export const NO_FILTERS: PoFilters = { families: [], months: [], statuses: [], search: '' }

/** Empty means everything, which is what an "All" pill selects. */
const allows = (chosen: string[], values: string[]) =>
  chosen.length === 0 || values.some((v) => chosen.includes(v))

export function matchesSearch(order: PoOrderT, search: string): boolean {
  const term = search.trim().toLowerCase()
  if (!term) return true
  return (
    order.po_number.toLowerCase().includes(term) || order.product.toLowerCase().includes(term)
  )
}

export function filterOrders(orders: PoOrderT[], filters: PoFilters): PoOrderT[] {
  return orders.filter(
    (order) =>
      allows(filters.families, familiesFor(order.product)) &&
      allows(filters.months, [dispatchMonthOf(order)]) &&
      allows(filters.statuses, [order.order_status.trim()]) &&
      matchesSearch(order, filters.search),
  )
}

export type PillCounts = {
  families: Record<string, number>
  months: Record<string, number>
  statuses: Record<string, number>
}

/**
 * What each pill would show if it were the only change to the current selection.
 *
 * Counted against the other active rows rather than against everything, so a
 * pill showing zero tells the reader that this combination is empty rather than
 * quietly promising rows that are not there. Section 6: a pill count never lies.
 */
export function pillCounts(orders: PoOrderT[], filters: PoFilters): PillCounts {
  const countFor = (row: keyof PillCounts, value: string) => {
    const narrowed: PoFilters = {
      ...filters,
      // Replace this row's selection with the single pill being counted, and
      // leave the other rows as they are.
      families: row === 'families' ? [value as ProductFamily] : filters.families,
      months: row === 'months' ? [value] : filters.months,
      statuses: row === 'statuses' ? [value] : filters.statuses,
    }
    return filterOrders(orders, narrowed).length
  }

  const families: Record<string, number> = {}
  for (const family of [...PRODUCT_FAMILIES, 'Other']) families[family] = countFor('families', family)

  const months: Record<string, number> = {}
  for (const month of dispatchMonths(orders)) months[month] = countFor('months', month)

  const statuses: Record<string, number> = {}
  for (const status of orderStatuses(orders)) statuses[status] = countFor('statuses', status)

  return { families, months, statuses }
}

export type OrderGroups = {
  /** Open and awaiting dispatch, first. */
  open: PoOrderT[]
  dispatched: PoOrderT[]
}

/**
 * Grouped by whether the order has actually gone. Dispatch is the fact; the
 * status column is what somebody typed, and the two can disagree.
 */
export function groupOrders(orders: PoOrderT[]): OrderGroups {
  const bySortOrder = (a: PoOrderT, b: PoOrderT) => a.sort_order - b.sort_order
  return {
    open: orders.filter((o) => o.dispatched_date === null).sort(bySortOrder),
    dispatched: orders
      .filter((o) => o.dispatched_date !== null)
      .sort((a, b) => b.dispatched_date!.localeCompare(a.dispatched_date!) || bySortOrder(a, b)),
  }
}

export type OrderSummary = { visible: number; notDispatched: number; dispatched: number }

export function summarise(orders: PoOrderT[]): OrderSummary {
  const dispatched = orders.filter((o) => o.dispatched_date !== null).length
  return { visible: orders.length, notDispatched: orders.length - dispatched, dispatched }
}

/**
 * The ledger lines behind one order, for the detail panel.
 *
 * Falls back to the base number when nothing matches exactly, which is the same
 * allowance the reconciliation makes for the thirteen orders the two systems
 * spell differently. Whether it matched exactly is returned, so the panel can
 * say which it did rather than implying certainty it does not have.
 */
export function ledgerRowsFor(
  poNumber: string,
  ledger: LedgerT,
): { rows: LedgerRowT[]; exact: boolean } {
  const wanted = poNumber.trim().toUpperCase()
  const exact = ledger.rows.filter((r) => (r.po_number ?? '').trim().toUpperCase() === wanted)
  if (exact.length > 0) return { rows: exact, exact: true }

  const base = wanted.replace(/-\d+$/, '')
  const loose = ledger.rows.filter(
    (r) => (r.po_number ?? '').trim().toUpperCase().replace(/-\d+$/, '') === base,
  )
  return { rows: loose, exact: false }
}
