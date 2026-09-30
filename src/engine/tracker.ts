/**
 * The PO tracker, with efdashboard.com's own rules. Every function here mirrors
 * one in efdashboard.com's page script of the same purpose, so the two sites
 * sort, group, tag and filter an order the same way. Where efdashboard.com
 * changes a rule, change it here too.
 */
import type { TrackerDocumentT, TrackerPayloadT, TrackerRowT } from './trackerSchema'

export type StateKey =
  | 'dispatched' | 'cancelled' | 'hold' | 'po-pending' | 'required' | 'requested'
  | 'confirmed' | 'ready' | 'booked' | 'awaiting' | 'processing'

export type TrackerPo = {
  id: number
  po: string
  product: string
  film: string
  rolls: string
  shipping: string
  ready: string
  qty: string
  dispatched: string
  status: string
  /** Derived, as efdashboard.com derives them. */
  state: { key: StateKey; label: string }
  isDispatched: boolean
  dispatchDate: string | null
  readyDate: string | null
  isAirfreight: boolean
  isInternal: boolean
  isInactive: boolean
  /** Kept at the bottom of the open list, as efdashboard.com's settings say. */
  pinnedBottom: boolean
  customerTag: string
  category: string
  formerPo: string | null
  orderedQuantities: { label: string; quantity: string }[]
  partialDispatches: { label: string; status: string; date?: string; pallets?: string; quantity?: string; note?: string }[]
  remarks: string
  shippingDetail: string
  documents: TrackerDocumentT[]
}

export type Tracker = {
  pos: TrackerPo[]
  updated: string | null
  fetchedAt: string
  byPo: Map<string, TrackerPo>
}

const MONTHS: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3, may: 4,
  jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8, september: 8,
  oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11,
}

/** efdashboard.com's parsePODate: day first, `11-Jul-2026` or `11/07/2026`. */
export function parsePoDate(value: string): string | null {
  const match = value.trim().match(/^(\d{1,2})[-/](\d{1,2}|[A-Za-z]+)[-/](\d{4})$/)
  if (!match) return null
  const day = Number(match[1])
  const token = match[2].toLowerCase()
  const month = /^\d+$/.test(token) ? Number(token) - 1 : MONTHS[token]
  const year = Number(match[3])
  if (month === undefined || !Number.isInteger(month) || month < 0 || month > 11) return null
  const at = new Date(Date.UTC(year, month, day))
  if (at.getUTCFullYear() !== year || at.getUTCMonth() !== month || at.getUTCDate() !== day) return null
  return at.toISOString().slice(0, 10)
}

export function productCategory(product: string): string {
  const v = product.toLowerCase()
  if (v.includes('aspen')) return 'Aspen'
  if (v.includes('oasis')) return 'Oasis'
  if (v.includes('pointfive') || v.includes('point five')) return 'PointFive'
  if (v.includes('destiny') || v.includes('7x7')) return 'Destiny'
  if (v.includes('platinum')) return 'Platinum'
  if (v.includes('northwest') || v.includes('nwf') || v.includes('dumpling')) return 'NWF'
  if (v.includes('medical') || v.includes('clamshell') || v.includes('cygnus')) return 'Cygnus'
  return 'Other Trays'
}

export const PRODUCT_FILTERS = ['Oasis', 'PointFive', 'Destiny', 'Platinum', 'Cygnus', 'NWF', 'Aspen', 'Other Trays']

export function matchesProduct(product: string, filter: string): boolean {
  if (filter === 'All') return true
  const v = product.toLowerCase()
  const matches: Record<string, boolean> = {
    Aspen: v.includes('aspen'),
    Oasis: v.includes('oasis'),
    PointFive: v.includes('pointfive') || v.includes('point five'),
    Destiny: v.includes('destiny') || v.includes('7x7'),
    Platinum: v.includes('platinum'),
    Cygnus: v.includes('oasis') || v.includes('medical') || v.includes('clamshell') || v.includes('cygnus'),
    NWF: v.includes('northwest') || v.includes('nwf') || v.includes('dumpling'),
  }
  if (filter === 'Other Trays') return !Object.values(matches).some(Boolean)
  return Boolean(matches[filter])
}

export function customerTag(product: string): string {
  const v = product.toLowerCase()
  if (v.includes('aspen')) return 'ASPEN'
  if (v.includes('northwest') || v.includes('nwf') || v.includes('dumpling')) return 'NWF'
  if (v.includes('oasis') || v.includes('medical') || v.includes('clamshell') || v.includes('cygnus')) return 'CYGNUS'
  if (v.includes('pointfive') || v.includes('point five')) return 'POINTFIVE'
  if (v.includes('destiny') || v.includes('7x7')) return 'DESTINY'
  if (v.includes('platinum')) return 'PLATINUM'
  return productCategory(product)
}

type Raw = Pick<TrackerPo, 'shipping' | 'status' | 'dispatched'>

export function isDispatched(r: Raw): boolean {
  return Boolean(parsePoDate(r.dispatched)) || `${r.shipping} ${r.status}`.toLowerCase().includes('dispatched')
}

export function isAirfreight(r: Raw): boolean {
  const c = `${r.shipping} ${r.status} ${r.dispatched}`.toLowerCase()
  return c.includes('airfreight') || c.includes('air freight') || c.includes('air-waybill') || c.includes('air waybill')
}

export function poState(r: Raw): { key: StateKey; label: string } {
  const c = `${r.shipping} ${r.status} ${r.dispatched}`.toLowerCase()
  if (isDispatched(r)) return { key: 'dispatched', label: 'Dispatched' }
  if (c.includes('cancel')) return { key: 'cancelled', label: 'Cancelled' }
  if (c.includes('on hold') || c.includes('held')) return { key: 'hold', label: 'On hold' }
  if (c.includes('po pending')) return { key: 'po-pending', label: 'PO pending' }
  if (c.includes('po required')) return { key: 'required', label: 'PO required' }
  if (c.includes('container requested')) return { key: 'requested', label: 'Container requested' }
  if (c.includes('container confirmed')) return { key: 'confirmed', label: 'Container confirmed' }
  if (c.includes('cargo ready') || c.includes('awaiting route')) return { key: 'ready', label: 'Cargo ready' }
  if (c.includes('booked')) return { key: 'booked', label: 'Booked' }
  if (c.includes('awaiting')) return { key: 'awaiting', label: 'Awaiting' }
  if (c.includes('loading')) return { key: 'processing', label: 'Loading' }
  return { key: 'processing', label: 'Processing' }
}

const hasValue = (v: string) => {
  const n = v.trim().toLowerCase()
  return Boolean(n) && !['-', '—', 'n/a'].includes(n)
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  try {
    return value ? (JSON.parse(value) as T) : fallback
  } catch {
    return fallback
  }
}

function partialDispatches(qty: string): TrackerPo['partialDispatches'] {
  const text = qty.trim()
  if (!text.toLowerCase().startsWith('partial_dispatch:')) return []
  const entries = parseJson<TrackerPo['partialDispatches']>(text.slice(text.indexOf(':') + 1), [])
  return Array.isArray(entries) ? entries.filter((e) => e?.label && e?.status) : []
}

export function buildTracker(payload: TrackerPayloadT): Tracker {
  const setting = (key: string) => payload.settings.find((s) => s.key === key)?.value ?? null
  const quantities = parseJson<Record<string, { label: string; quantity: string }[]>>(setting('po_order_quantities'), {})
  const former = parseJson<Record<string, string>>(setting('po_former_numbers'), {})
  const internal = parseJson<Record<string, boolean>>(setting('po_internal_orders'), {})
  const bottom = new Set(parseJson<unknown[]>(setting('po_bottom_orders'), []).map(String))

  const docs = new Map<string, TrackerDocumentT[]>()
  for (const d of payload.documents) docs.set(d.po, [...(docs.get(d.po) ?? []), d])

  const rows = [...payload.rows].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  const pos = rows.map((r: TrackerRowT): TrackerPo => {
    const raw = { shipping: r.shipping, status: r.status, dispatched: r.dispatched }
    const state = poState(raw)
    const status = r.status.trim()
    const remarks = !status || status.toLowerCase() === 'dispatched' || status.toLowerCase() === state.label.toLowerCase() ? '' : status
    const shipping = r.shipping.trim()
    return {
      id: r.id,
      po: r.po_number.trim(),
      product: r.product,
      film: r.film,
      rolls: r.rolls,
      shipping: r.shipping,
      ready: r.cargo_ready,
      qty: r.qty,
      dispatched: r.dispatched,
      status: r.status,
      state,
      isDispatched: isDispatched(raw),
      dispatchDate: parsePoDate(r.dispatched),
      readyDate: parsePoDate(r.cargo_ready),
      isAirfreight: isAirfreight(raw),
      isInternal: Boolean(internal[r.po_number.trim()]),
      isInactive: ['hold', 'cancelled', 'po-pending'].includes(state.key),
      pinnedBottom: bottom.has(r.po_number.trim()),
      customerTag: customerTag(r.product),
      category: productCategory(r.product),
      formerPo: former[r.po_number.trim()]?.trim() || null,
      orderedQuantities: (quantities[r.po_number.trim()] ?? []).filter((e) => e?.label && e?.quantity),
      partialDispatches: partialDispatches(r.qty),
      remarks,
      shippingDetail: hasValue(shipping) && shipping.toLowerCase() !== state.label.toLowerCase() ? shipping : '',
      documents: docs.get(r.po_number.trim()) ?? [],
    }
  })

  return {
    pos,
    updated: setting('po_last_updated') ?? setting('last_updated'),
    fetchedAt: payload.fetched_at,
    byPo: new Map(pos.map((p) => [p.po, p])),
  }
}

/** Dispatch quantities, one per line, each ticked as efdashboard.com ticks them. */
export function dispatchQuantityLines(p: TrackerPo): string[] {
  if (!p.isDispatched || !hasValue(p.qty) || p.partialDispatches.length) return []
  return p.qty
    .split(/\s*;\s*/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => (/[✅✓]/u.test(l) ? l : `${l} ✅`))
}

export type TrackerFilters = {
  product: string
  month: string
  status: string
  search: string
  showInactive: boolean
  include2025: boolean
}

export const NO_FILTERS: TrackerFilters = {
  product: 'All', month: 'all', status: 'All', search: '', showInactive: false, include2025: false,
}

/**
 * efdashboard.com shows dispatches from 2026 on, with a switch for 2025. The
 * years are its rule, copied as they are.
 */
const CURRENT_YEAR_FROM = 2026
const HISTORY_YEAR = 2025

export function visibleBase(t: Tracker, f: TrackerFilters): TrackerPo[] {
  return t.pos.filter((p) => {
    if (!f.showInactive && p.isInactive) return false
    if (!p.isDispatched || !p.dispatchDate) return true
    const year = Number(p.dispatchDate.slice(0, 4))
    return year >= CURRENT_YEAR_FROM || (f.include2025 && year === HISTORY_YEAR)
  })
}

const STATUS_ORDER = ['Dispatched', 'Container confirmed', 'Booked', 'Container requested', 'Cargo ready', 'Awaiting', 'Loading', 'Processing', 'PO pending', 'Cancelled', 'On hold', 'PO required']

export type Pill = { value: string; label: string; count: number }

/** The three rows of filter pills, with efdashboard.com's counts. */
export function filterPills(t: Tracker, f: TrackerFilters) {
  const base = visibleBase(t, f)
  const products: Pill[] = [
    { value: 'All', label: 'All products', count: base.length },
    ...PRODUCT_FILTERS.map((c) => ({ value: c, label: c, count: base.filter((p) => matchesProduct(p.product, c)).length })).filter(
      (p) => p.count > 0,
    ),
  ]
  const productRows = f.product === 'All' ? base : base.filter((p) => matchesProduct(p.product, f.product))
  const monthCounts = new Map<string, number>()
  for (const p of productRows.filter((x) => x.isDispatched && x.dispatchDate)) {
    const key = p.dispatchDate!.slice(0, 7)
    monthCounts.set(key, (monthCounts.get(key) ?? 0) + 1)
  }
  const months: Pill[] = [
    { value: 'all', label: 'All dates', count: productRows.length },
    { value: 'open', label: 'Not dispatched', count: productRows.filter((p) => !p.isDispatched).length },
    ...[...monthCounts.keys()].sort().reverse().map((k) => ({ value: k, label: k, count: monthCounts.get(k)! })),
  ]
  const monthRows = productRows.filter((p) =>
    f.month === 'open' ? !p.isDispatched : f.month === 'all' ? true : p.dispatchDate?.slice(0, 7) === f.month,
  )
  const statusCounts = new Map<string, number>()
  for (const p of monthRows) statusCounts.set(p.state.label, (statusCounts.get(p.state.label) ?? 0) + 1)
  const rank = (l: string) => (STATUS_ORDER.indexOf(l) < 0 ? STATUS_ORDER.length : STATUS_ORDER.indexOf(l))
  const statuses: Pill[] = [
    { value: 'All', label: 'All statuses', count: monthRows.length },
    ...[...statusCounts.keys()].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b)).map((l) => ({ value: l, label: l, count: statusCounts.get(l)! })),
  ]
  return { products, months, statuses }
}

export function filterTracker(t: Tracker, f: TrackerFilters): TrackerPo[] {
  const search = f.search.trim().toLowerCase()
  const rows = visibleBase(t, f).filter((p) => {
    if (!matchesProduct(p.product, f.product)) return false
    if (f.month === 'open' && p.isDispatched) return false
    if (f.month !== 'all' && f.month !== 'open' && p.dispatchDate?.slice(0, 7) !== f.month) return false
    if (f.status !== 'All' && p.state.label !== f.status) return false
    if (search) {
      const hay = [
        p.product, p.po, p.film, p.shipping, p.ready, p.qty, p.dispatched, p.status, p.category, p.customerTag,
        p.formerPo ?? '', p.isInternal ? 'ecofibre order internal' : '',
        ...p.orderedQuantities.flatMap((e) => [e.label, e.quantity]),
      ].join(' ').toLowerCase()
      if (!hay.includes(search)) return false
    }
    return true
  })
  const openRank = (k: StateKey) => (k === 'confirmed' ? 0 : k === 'booked' ? 1 : k === 'po-pending' ? 3 : k === 'cancelled' ? 4 : k === 'hold' ? 5 : 2)
  return rows.sort((a, b) => {
    if (a.isDispatched !== b.isDispatched) return a.isDispatched ? 1 : -1
    if (a.isDispatched) return (b.dispatchDate ?? '').localeCompare(a.dispatchDate ?? '') || a.po.localeCompare(b.po)
    if (a.pinnedBottom !== b.pinnedBottom) return a.pinnedBottom ? 1 : -1
    return (
      openRank(a.state.key) - openRank(b.state.key) ||
      (a.readyDate ?? '9999').localeCompare(b.readyDate ?? '9999') ||
      a.po.localeCompare(b.po)
    )
  })
}

/** Open, dispatched and inactive, as efdashboard.com groups them. */
export function groupTracker(rows: TrackerPo[]) {
  return [
    { label: 'Open / awaiting dispatch', rows: rows.filter((p) => !p.isDispatched && !p.isInactive) },
    { label: 'Dispatched', rows: rows.filter((p) => p.isDispatched) },
    { label: 'Inactive POs', rows: rows.filter((p) => p.isInactive && !p.isDispatched) },
  ].filter((g) => g.rows.length > 0)
}
