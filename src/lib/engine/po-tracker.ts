import type { LedgerRowT, LedgerT, PoOrderT, PoTrackerT } from '../schema'

/**
 * Reconciling the order tracker against the statement ledger.
 *
 * PO-TRACKER-SPEC section 1 makes this a standing output of every import rather
 * than a one-off, because it has repeatedly found real errors. It is here, as a
 * pure function, so it is tested rather than trusted, and so the importer and any
 * future screen report the same thing.
 */
const normalise = (value: string | null | undefined) => String(value ?? '').trim().toUpperCase()

/** `2465639-2` to `2465639`. The suffix is the line or shipment, not the order. */
const baseNumber = (value: string) => normalise(value).replace(/-\d+$/, '')

export type SuffixMatch = {
  trackerPo: string
  ledgerPo: string
  base: string
}

export type Reconciliation = {
  trackerCount: number
  ledgerCount: number
  /** Same PO number on both sides. */
  exact: string[]
  /**
   * Same order, different suffix. Reported rather than merged silently: the two
   * systems disagree about how the reference is written, and that is worth
   * knowing even though it is almost certainly the same order.
   */
  suffixOnly: SuffixMatch[]
  /** In the tracker, absent from the ledger. */
  trackerOnly: PoOrderT[]
  /** In the ledger, absent from the tracker. */
  ledgerOnly: LedgerRowT[]
}

export function reconcileTracker(tracker: PoTrackerT, ledger: LedgerT): Reconciliation {
  const trackerByPo = new Map<string, PoOrderT>()
  for (const order of tracker.orders) {
    const key = normalise(order.po_number)
    if (key) trackerByPo.set(key, order)
  }

  const ledgerByPo = new Map<string, LedgerRowT>()
  for (const row of ledger.rows) {
    const key = normalise(row.po_number)
    if (key) ledgerByPo.set(key, row)
  }

  const exact = [...trackerByPo.keys()].filter((po) => ledgerByPo.has(po)).sort()
  const matched = new Set(exact)

  // Only what is still unmatched is considered for a suffix match, and only where
  // exactly one candidate remains on each side. Two ledger lines sharing a base
  // number is a known condition, not a licence to guess which one is meant.
  const remainingTracker = new Map<string, string[]>()
  for (const po of trackerByPo.keys()) {
    if (matched.has(po)) continue
    const base = baseNumber(po)
    remainingTracker.set(base, [...(remainingTracker.get(base) ?? []), po])
  }
  const remainingLedger = new Map<string, string[]>()
  for (const po of ledgerByPo.keys()) {
    if (matched.has(po)) continue
    const base = baseNumber(po)
    remainingLedger.set(base, [...(remainingLedger.get(base) ?? []), po])
  }

  const suffixOnly: SuffixMatch[] = []
  for (const [base, trackerPos] of remainingTracker) {
    const ledgerPos = remainingLedger.get(base)
    if (!ledgerPos || trackerPos.length !== 1 || ledgerPos.length !== 1) continue
    suffixOnly.push({ trackerPo: trackerPos[0], ledgerPo: ledgerPos[0], base })
  }
  suffixOnly.sort((a, b) => a.base.localeCompare(b.base))

  const matchedTracker = new Set([...exact, ...suffixOnly.map((m) => m.trackerPo)])
  const matchedLedger = new Set([...exact, ...suffixOnly.map((m) => m.ledgerPo)])

  return {
    trackerCount: trackerByPo.size,
    ledgerCount: ledgerByPo.size,
    exact,
    suffixOnly,
    trackerOnly: [...trackerByPo.entries()]
      .filter(([po]) => !matchedTracker.has(po))
      .map(([, order]) => order),
    ledgerOnly: [...ledgerByPo.entries()]
      .filter(([po]) => !matchedLedger.has(po))
      .map(([, row]) => row),
  }
}

/**
 * The earliest dispatch the tracker knows about.
 *
 * Most of what sits in the ledger and not in the tracker was delivered before the
 * tracker began, which is an explanation rather than a discrepancy. Returning the
 * boundary lets the report say which is which instead of listing everything as a
 * problem.
 */
export function trackerBegins(tracker: PoTrackerT): string | null {
  const dates = tracker.orders
    .map((order) => order.dispatched_date)
    .filter((date): date is string => date !== null)
    .sort()
  return dates[0] ?? null
}
