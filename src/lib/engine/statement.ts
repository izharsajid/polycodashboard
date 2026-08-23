import type { LedgerRowT, LedgerT } from '../schema'
import { orderCover, round2, uncoveredAdvance } from './index'

/**
 * The master statement: every transaction between the two companies, in date
 * order, with a running balance.
 *
 * **The convention, stated once here and again on the page.** Funds received from
 * Polyco increase the balance owed to them in goods; delivered value reduces it.
 * A positive closing balance means EcoFibre holds value yet to be delivered.
 * Without saying this, two accountants read the same column in opposite
 * directions.
 */
export type EntryKind = 'receipt' | 'delivery' | 'order'

export type StatementEntry = {
  /** Stable across renders and exports. Source row plus kind, because one ledger row can produce two entries. */
  id: string
  sourceRow: number
  kind: EntryKind
  type: LedgerRowT['type']
  /** The corrected date. Null where the source carries none we can use. */
  date: string | null
  /** What the workbook said, where that differs from the corrected date. */
  originalDate: string | null
  /** The corrected date differs from the source and has not been confirmed. */
  dateUnconfirmed: boolean
  reference: string
  product: string | null
  poAmount: number | null
  proformaRef: string | null
  proformaAmount: number | null
  /** An order placed and not yet delivered, which the workbook shows as pending. */
  pendingValue: number | null
  delivered: number
  received: number
  /** received less delivered. The signed effect on the balance. */
  movement: number
  loaded: string | null
  flags: string[]
}

export type BalancedEntry = StatementEntry & { balance: number }

function entryFor(row: LedgerRowT, kind: EntryKind): StatementEntry {
  const date =
    kind === 'receipt' ? row.received_date : kind === 'delivery' ? row.delivery_date : null
  const originalDate =
    kind === 'receipt'
      ? row.received_date_source
      : kind === 'delivery'
        ? row.delivery_date_source
        : null

  const received = kind === 'receipt' ? (row.received ?? 0) : 0
  const delivered = kind === 'delivery' ? (row.delivered_value ?? 0) : 0

  return {
    id: `${row.source_row}:${kind}`,
    sourceRow: row.source_row,
    kind,
    type: row.type,
    date,
    originalDate,
    // Only a date that was changed on the way in is unconfirmed. A row can carry
    // a flag about something else entirely and still have a date nobody doubts.
    dateUnconfirmed: row.flags.length > 0 && originalDate !== date,
    reference: row.ref,
    product: row.product,
    poAmount: row.po_amount,
    proformaRef: row.proforma_ref,
    proformaAmount: row.proforma_amount,
    pendingValue: kind === 'order' ? row.po_amount : null,
    delivered,
    received,
    movement: round2(received - delivered),
    loaded: row.loaded,
    flags: row.flags,
  }
}

/**
 * One entry per transaction, which is not the same as one per ledger row.
 *
 * Nineteen ledger rows carry both a receipt and a delivery, on different dates.
 * Kept as single rows they would each need two dates and two positions in a
 * chronological sequence, and the running balance would be wrong. Split, each
 * entry has one date, one movement and one place in the order. Both halves keep
 * the same `sourceRow`, so a reconciler can always trace back to the workbook
 * line.
 *
 * Purchase orders that have not been delivered are entries too, with no movement.
 * They are commitments rather than transactions, and leaving them out would be
 * dropping a row.
 */
export function statementEntries(ledger: LedgerT): StatementEntry[] {
  const entries: StatementEntry[] = []

  for (const row of ledger.rows) {
    if (row.received) entries.push(entryFor(row, 'receipt'))
    if (row.delivered_value) entries.push(entryFor(row, 'delivery'))
    if (!row.received && !row.delivered_value) entries.push(entryFor(row, 'order'))
  }

  return entries.sort(chronological)
}

/** Dated first, oldest first. Undated last, in workbook order. Never invent a date. */
function chronological(a: StatementEntry, b: StatementEntry): number {
  if (a.date && b.date) {
    return a.date.localeCompare(b.date) || a.sourceRow - b.sourceRow || a.kind.localeCompare(b.kind)
  }
  if (a.date) return -1
  if (b.date) return 1
  return a.sourceRow - b.sourceRow || a.kind.localeCompare(b.kind)
}

export type StatementRange = { from?: string | null; to?: string | null }

export type StatementView = {
  filtered: boolean
  /** The closing balance of everything before the range. Zero when unfiltered. */
  opening: number
  entries: BalancedEntry[]
  /** Sum of the movements of the entries shown. */
  movement: number
  /** opening + movement. Asserted in the tests. */
  closing: number
  /**
   * Entries with no usable date. Part of the sequence and the closing balance
   * when unfiltered; set aside when a range is applied, because a row without a
   * date cannot honestly be placed inside or outside one.
   */
  undated: StatementEntry[]
  undatedTotal: number
  /** How many entries in what is shown carry a date that has not been confirmed. */
  unconfirmedDates: number
  /**
   * Entries the range excludes on their corrected date but would have included on
   * the date the workbook originally carried. Shown below the statement and
   * outside the totals, because a row missing from a statement is far worse than
   * a row present and flagged.
   */
  nearMisses: StatementEntry[]
}

/**
 * Filter, run the balance, and state where everything went.
 *
 * The opening balance is the whole point. A date filter that opens at zero makes
 * the page useless for reconciliation, so opening is the closing balance of every
 * dated entry before the range.
 *
 * Undated entries are treated differently depending on whether a range is
 * applied, and the asymmetry is deliberate. Unfiltered, they sit at the end of
 * the sequence and inside the closing balance, which is what makes the closing
 * tie to the ledger. Filtered, they are set aside: section 2 requires closing to
 * equal opening plus "the movement in the period shown", and an entry with no
 * date is in no period. They are returned with their total so the page can say
 * where they went, rather than dropping them.
 */
export function statementView(ledger: LedgerT, range: StatementRange = {}): StatementView {
  const all = statementEntries(ledger)
  const from = range.from ?? null
  const to = range.to ?? null
  const filtered = from !== null || to !== null

  const dated = all.filter((e): e is StatementEntry & { date: string } => e.date !== null)
  const undated = all.filter((e) => e.date === null)
  const undatedTotal = round2(undated.reduce((total, e) => total + e.movement, 0))

  const before = from === null ? [] : dated.filter((e) => e.date < from)
  const opening = round2(before.reduce((total, e) => total + e.movement, 0))

  const inRange = dated.filter((e) => (from === null || e.date >= from) && (to === null || e.date <= to))

  // Unfiltered, the undated entries sort to the end of the sequence, exactly as
  // section 7 requires, and are carried in the balance.
  const sequence: StatementEntry[] = filtered ? inRange : [...inRange, ...undated]

  let balance = opening
  const entries: BalancedEntry[] = sequence.map((entry) => {
    balance = round2(balance + entry.movement)
    return { ...entry, balance }
  })

  const movement = round2(sequence.reduce((total, e) => total + e.movement, 0))

  // Section 4. A corrected date can push a row out of a range on the strength of
  // a correction nobody has confirmed. Anything the original date would have
  // caught is surfaced rather than left for Polyco to discover missing.
  const shown = new Set(sequence.map((e) => e.id))
  const inWindow = (day: string | null) =>
    day !== null && (from === null || day >= from) && (to === null || day <= to)
  const nearMisses = filtered
    ? all.filter((e) => !shown.has(e.id) && e.dateUnconfirmed && inWindow(e.originalDate))
    : []

  return {
    filtered,
    opening,
    entries,
    movement,
    closing: round2(opening + movement),
    undated,
    undatedTotal,
    unconfirmedDates: sequence.filter((e) => e.dateUnconfirmed).length,
    nearMisses,
  }
}

/**
 * The columns a reader can choose from. Section 3.
 *
 * One definition drives the table and the export, so what is on screen and what
 * lands in Excel cannot drift apart.
 */
export type ColumnKey =
  | 'serial' | 'poAndDate' | 'product' | 'poValue' | 'proformaRef' | 'proformaAmount'
  | 'delivered' | 'received' | 'receivedDate' | 'loaded' | 'pendingValue'
  | 'deliveryDate' | 'balance' | 'type' | 'flags'

export type ColumnDef = {
  key: ColumnKey
  label: string
  /** Right-aligned. Not every right-aligned column is money. */
  numeric: boolean
  /** Formatted with a currency symbol. A serial number is numeric and not money. */
  money?: boolean
  isDefault: boolean
  /** A statement without a running balance is a list of rows. */
  locked?: boolean
}

/**
 * The statement workbook's own columns, in its order.
 *
 * REDESIGN-2-SPEC section 6: this layout has gone to Polyco for years and their
 * finance team reads it fluently. Replacing it with a ledger of our own design
 * made them learn a new document to check a familiar one.
 *
 * The source row column is gone: it is our trace back to the workbook and means
 * nothing to a reader. The running balance is an addition rather than a
 * replacement, since the workbook has no equivalent, and it is what makes the
 * page reconcilable, so it stays and stays on by default.
 */
export const COLUMNS: ColumnDef[] = [
  { key: 'serial', label: 'S. No.', numeric: true, isDefault: true },
  { key: 'poAndDate', label: 'PO no. and date', numeric: false, isDefault: true },
  { key: 'product', label: 'Product', numeric: false, isDefault: true },
  { key: 'poValue', label: 'PO amount', numeric: true, money: true, isDefault: true },
  { key: 'proformaRef', label: 'Proforma inv. no. and date', numeric: false, isDefault: true },
  { key: 'proformaAmount', label: 'Proforma inv. amount', numeric: true, money: true, isDefault: true },
  { key: 'delivered', label: 'Delivered value', numeric: true, money: true, isDefault: true },
  { key: 'received', label: 'Received', numeric: true, money: true, isDefault: true },
  { key: 'receivedDate', label: 'Funds received date', numeric: false, isDefault: true },
  { key: 'loaded', label: 'Loaded on container', numeric: false, isDefault: true },
  { key: 'pendingValue', label: 'Pending value to deliver', numeric: true, money: true, isDefault: true },
  { key: 'deliveryDate', label: 'Delivery date', numeric: false, isDefault: true },
  { key: 'balance', label: 'Running balance', numeric: true, money: true, isDefault: true, locked: true },
  { key: 'type', label: 'Type', numeric: false, isDefault: false },
  { key: 'flags', label: 'Flags', numeric: false, isDefault: false },
]

export const DEFAULT_COLUMNS: ColumnKey[] = COLUMNS.filter((c) => c.isDefault).map((c) => c.key)

export const PRESETS: Record<string, { label: string; columns: ColumnKey[] }> = {
  reconciliation: {
    label: 'Reconciliation',
    columns: ['serial', 'poAndDate', 'received', 'receivedDate', 'delivered', 'deliveryDate', 'balance'],
  },
  full: { label: 'Full detail', columns: COLUMNS.map((c) => c.key) },
}

/**
 * What kind of transaction this entry is, from the movement it carries rather
 * than from the type on its ledger row.
 *
 * Those two disagree on nineteen rows. A row typed `delivery` can carry a receipt
 * and a delivery on different dates, and the receipt half of it is a receipt
 * whatever the row is called. Labelling by the row put "Delivery" against a line
 * that raised the balance, which reads as a sign error to anyone reconciling.
 *
 * Recharges keep their own label on the delivery side, because section 7 has them
 * appearing as recharges and sitting inside delivered value.
 */
export function entryTypeLabel(entry: StatementEntry): string {
  if (entry.kind === 'receipt') return 'Receipt'
  if (entry.kind === 'order') return 'Purchase order'
  return entry.type === 'recharge' ? 'Recharge' : 'Delivery'
}

/**
 * One cell. Numbers stay numbers, so a column sums in Excel; an accountant who
 * cannot total a column will not open the file twice.
 */
export function cellValue(entry: BalancedEntry, key: ColumnKey): string | number | null {
  switch (key) {
    case 'serial': return entry.sourceRow
    // The workbook carries the PO reference and its date in one cell, as `ref`
    // already does.
    case 'poAndDate': return entry.reference
    case 'product': return entry.product
    case 'poValue': return entry.poAmount
    case 'proformaRef': return entry.proformaRef
    case 'proformaAmount': return entry.proformaAmount
    case 'delivered': return entry.delivered || null
    case 'received': return entry.received || null
    case 'receivedDate': return entry.kind === 'receipt' ? entry.date : null
    case 'loaded': return entry.loaded
    case 'pendingValue': return entry.pendingValue
    case 'deliveryDate': return entry.kind === 'delivery' ? entry.date : null
    case 'balance': return entry.balance
    case 'type': return entryTypeLabel(entry)
    case 'flags': return entry.flags.length ? entry.flags.join('; ') : null
  }
}

/**
 * Sorting. Date ascending is the default and the only order in which a running
 * balance means anything, which is why any other sort drops it.
 */
export type SortKey = ColumnKey
export type SortDirection = 'asc' | 'desc'

export function sortEntries(
  entries: BalancedEntry[],
  key: SortKey,
  direction: SortDirection,
): BalancedEntry[] {
  if (key === 'serial') {
    const sorted = [...entries]
    return direction === 'asc' ? sorted : sorted.reverse()
  }

  const factor = direction === 'asc' ? 1 : -1
  return [...entries].sort((a, b) => {
    const left = cellValue(a, key)
    const right = cellValue(b, key)
    if (left === right) return a.sourceRow - b.sourceRow
    if (left === null) return 1
    if (right === null) return -1
    if (typeof left === 'number' && typeof right === 'number') return (left - right) * factor
    return String(left).localeCompare(String(right)) * factor
  })
}

/** A running balance out of date order is meaningless, so it is not offered. */
export function balanceIsMeaningful(sort: SortKey): boolean {
  return sort === 'serial'
}

/**
 * The three headline figures as whole dollars that add up.
 *
 * REDESIGN-SPEC section 6 rounds headline tiles to whole dollars. Rounding each
 * of the three independently produces sets that do not add: opening 1,259,494.59
 * and movement 649,567.85 round to 1,259,495 and 649,568, which read as
 * 1,909,063 against a closing of 1,909,062. To the one audience that will
 * certainly check, that is an error on the page.
 *
 * The two balances are the figures that tie to anything, so they are rounded and
 * the movement is shown as the difference between them. It can sit a dollar off
 * the movement's own rounding, which is the right thing to give up.
 */
export function wholeDollars(view: StatementView): {
  opening: number
  movement: number
  closing: number
} {
  const opening = Math.round(view.opening)
  const closing = Math.round(view.closing)
  return { opening, movement: closing - opening, closing }
}

export type StatementTie = {
  /** The unfiltered closing balance of this statement. */
  closing: number
  /** The same figure from the ledger summary, arrived at a different way. */
  receivedLessDelivered: number
  /** Open orders and containers, from Tab 1. */
  orderCover: number
  /** Tab 1's headline: what is left after every open order and ready container ships. */
  uncoveredAdvance: number
  tiesToLedgerSummary: boolean
  tiesToTab1: boolean
}

/**
 * The tie, computed rather than asserted in prose.
 *
 * The statement's closing balance is what has been received less what has been
 * delivered, because those are the only transactions there are. That is Tab 1's
 * "advance held against future delivery" line. Tab 1's headline figure is that
 * balance less the open order book and the containers already made, which are
 * commitments and not transactions, so they cannot appear in a running balance.
 *
 * Both links are checked here, because "ties to Tab 1" is true of two different
 * figures on Tab 1 and only one of them is the closing balance.
 */
export function statementTie(ledger: LedgerT): StatementTie {
  const closing = statementView(ledger).closing
  const receivedLessDelivered = round2(
    ledger.summary.total_received - ledger.summary.total_delivered,
  )
  const cover = orderCover(ledger)

  return {
    closing,
    receivedLessDelivered,
    orderCover: cover,
    uncoveredAdvance: uncoveredAdvance(ledger),
    tiesToLedgerSummary: closing === receivedLessDelivered,
    tiesToTab1: round2(closing - cover) === uncoveredAdvance(ledger),
  }
}

export type BalancePoint = { date: string; balance: number }

/**
 * The advance balance over time, as one series.
 *
 * REDESIGN-2-SPEC section 5: the old chart drew cumulative receipts and
 * cumulative deliveries and shaded the space between them, which asks a reader
 * to subtract two lines by eye to find the answer. This *is* that space,
 * computed, so no arithmetic is required. It rises when Polyco pays and falls
 * when goods ship.
 *
 * No new figure: the last point equals the closing balance the statement already
 * reports, and there is a test holding the two together.
 */
export function advanceBalanceSeries(ledger: LedgerT): BalancePoint[] {
  const dated = statementEntries(ledger).filter(
    (entry): entry is StatementEntry & { date: string } => entry.date !== null,
  )

  const points: BalancePoint[] = []
  let balance = 0

  for (const entry of dated) {
    balance = round2(balance + entry.movement)
    const last = points[points.length - 1]
    // One point per day: a day with three movements is one step on the line.
    if (last && last.date === entry.date) last.balance = balance
    else points.push({ date: entry.date, balance })
  }

  return points
}
