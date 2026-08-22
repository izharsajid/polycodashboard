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

  return {
    filtered,
    opening,
    entries,
    movement,
    closing: round2(opening + movement),
    undated,
    undatedTotal,
    unconfirmedDates: sequence.filter((e) => e.dateUnconfirmed).length,
  }
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
