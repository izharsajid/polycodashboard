import { NO_FILTERS, PRODUCT_FAMILIES, type PoFilters, type ProductFamily } from './engine/po-filter'

/**
 * The tracker view, carried in the query string, so a link reproduces it.
 * PO-TRACKER-SPEC section 2.
 *
 * Pure and tested. Anything unrecognised falls back rather than throwing: a
 * hand-edited link, or one that predates a status being renamed, should still open.
 */
const FAMILIES = new Set<string>([...PRODUCT_FAMILIES, 'Other'])

const list = (value: string | null) =>
  (value ?? '').split(',').map((v) => v.trim()).filter(Boolean)

export function readPoUrl(search: string): PoFilters {
  const params = new URLSearchParams(search)

  return {
    families: list(params.get('family')).filter((f): f is ProductFamily => FAMILIES.has(f)),
    months: list(params.get('month')),
    statuses: list(params.get('status')).map(decodeURIComponent),
    search: (params.get('q') ?? '').slice(0, 80),
  }
}

/** Only what differs from showing everything, so an untouched view has a clean URL. */
export function writePoUrl(filters: PoFilters): string {
  const params = new URLSearchParams()
  if (filters.families.length) params.set('family', filters.families.join(','))
  if (filters.months.length) params.set('month', filters.months.join(','))
  if (filters.statuses.length) params.set('status', filters.statuses.map(encodeURIComponent).join(','))
  if (filters.search.trim()) params.set('q', filters.search.trim())

  const query = params.toString()
  return query ? `?${query}` : ''
}

/** Adding or removing one pill within its row. */
export function togglePill<T extends string>(chosen: T[], value: T): T[] {
  return chosen.includes(value) ? chosen.filter((v) => v !== value) : [...chosen, value]
}

export const CLEARED = NO_FILTERS
