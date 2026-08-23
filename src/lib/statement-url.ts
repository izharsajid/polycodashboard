import { COLUMNS, DEFAULT_COLUMNS, type ColumnKey } from './engine/statement'

/**
 * The view, carried in the query string, so a colleague opening a shared link
 * sees what the sender saw. Section 3.
 *
 * Pure, so it is tested rather than trusted. Anything unrecognised falls back to
 * the default rather than throwing: a link that has been edited by hand, or that
 * predates a column being renamed, should still open.
 */
export type StatementUrlState = {
  from: string | null
  to: string | null
  columns: ColumnKey[]
  sort: ColumnKey
  direction: 'asc' | 'desc'
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/
const KEYS = new Set(COLUMNS.map((c) => c.key))

const isColumn = (value: string): value is ColumnKey => KEYS.has(value as ColumnKey)

export const DEFAULT_STATE: StatementUrlState = {
  from: null,
  to: null,
  columns: DEFAULT_COLUMNS,
  sort: 'serial',
  direction: 'asc',
}

export function readStatementUrl(search: string): StatementUrlState {
  const params = new URLSearchParams(search)

  const day = (key: string) => {
    const value = params.get(key)
    return value && ISO_DAY.test(value) ? value : null
  }

  const requested = (params.get('cols') ?? '').split(',').filter(isColumn)
  // The running balance is never removable, so it is put back if a link drops it.
  const columns = requested.length
    ? [...new Set<ColumnKey>([...requested, 'balance'])]
    : DEFAULT_STATE.columns

  const sortParam = params.get('sort')
  const sort = sortParam && isColumn(sortParam) ? sortParam : DEFAULT_STATE.sort

  return {
    from: day('from'),
    to: day('to'),
    columns,
    sort,
    direction: params.get('dir') === 'desc' ? 'desc' : 'asc',
  }
}

/** Only what differs from the default, so an unmodified view has a clean URL. */
export function writeStatementUrl(state: StatementUrlState): string {
  const params = new URLSearchParams()
  if (state.from) params.set('from', state.from)
  if (state.to) params.set('to', state.to)

  const sameColumns =
    state.columns.length === DEFAULT_STATE.columns.length &&
    state.columns.every((c, i) => c === DEFAULT_STATE.columns[i])
  if (!sameColumns) params.set('cols', state.columns.join(','))

  if (state.sort !== DEFAULT_STATE.sort) params.set('sort', state.sort)
  if (state.direction !== DEFAULT_STATE.direction) params.set('dir', state.direction)

  const query = params.toString()
  return query ? `?${query}` : ''
}

/** The date presets from section 4, resolved against a given day. */
export type PresetKey = 'this-month' | 'last-month' | 'last-three' | 'this-year' | 'all'

export const DATE_PRESETS: { key: PresetKey; label: string }[] = [
  { key: 'this-month', label: 'This month' },
  { key: 'last-month', label: 'Last month' },
  { key: 'last-three', label: 'Last three months' },
  { key: 'this-year', label: 'This year' },
  { key: 'all', label: 'All' },
]

const iso = (date: Date) => date.toISOString().slice(0, 10)

export function resolvePreset(key: PresetKey, today: Date): { from: string | null; to: string | null } {
  const year = today.getUTCFullYear()
  const month = today.getUTCMonth()

  switch (key) {
    case 'this-month':
      return { from: iso(new Date(Date.UTC(year, month, 1))), to: iso(new Date(Date.UTC(year, month + 1, 0))) }
    case 'last-month':
      return { from: iso(new Date(Date.UTC(year, month - 1, 1))), to: iso(new Date(Date.UTC(year, month, 0))) }
    case 'last-three':
      return { from: iso(new Date(Date.UTC(year, month - 2, 1))), to: iso(new Date(Date.UTC(year, month + 1, 0))) }
    case 'this-year':
      return { from: iso(new Date(Date.UTC(year, 0, 1))), to: iso(new Date(Date.UTC(year, 11, 31))) }
    case 'all':
      return { from: null, to: null }
  }
}
