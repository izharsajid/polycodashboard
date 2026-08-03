import type { LedgerT, LedgerRowT, StatementsT, StatementT } from '../schema'

export const round2 = (n: number) => Math.round(n * 1e2) / 1e2

/**
 * Uncovered advance.
 *
 *   received − delivered − POs pending − containers ready − containers in process
 *
 * Cargo clearing and freight recharged to Polyco already sit inside delivered
 * value. They are NOT deducted again here. Deducting them a second time was the
 * error in statements up to February 2026.
 */
export function uncoveredAdvance(l: LedgerT) {
  const s = l.summary
  return round2(
    s.total_received -
      s.total_delivered -
      s.pos_pending_to_deliver -
      s.containers_ready_next_month -
      s.containers_in_process_following_month,
  )
}

export function orderCover(l: LedgerT) {
  const s = l.summary
  return round2(
    s.pos_pending_to_deliver +
      s.containers_ready_next_month +
      s.containers_in_process_following_month,
  )
}

export type CumulativePoint = {
  date: string
  receivedCumulative: number
  deliveredCumulative: number
  gap: number
}

/** Cumulative receipts against cumulative deliveries. The gap is the advance. */
export function cumulativeSeries(l: LedgerT): CumulativePoint[] {
  type Ev = { date: string; received: number; delivered: number }
  const events: Ev[] = []
  for (const r of l.rows) {
    if (r.received && r.received_date) {
      events.push({ date: r.received_date, received: r.received, delivered: 0 })
    }
    if (r.delivered_value && r.delivery_date) {
      events.push({ date: r.delivery_date, received: 0, delivered: r.delivered_value })
    }
  }
  events.sort((a, b) => a.date.localeCompare(b.date))

  const byDate = new Map<string, Ev>()
  for (const e of events) {
    const hit = byDate.get(e.date)
    if (hit) {
      hit.received += e.received
      hit.delivered += e.delivered
    } else byDate.set(e.date, { ...e })
  }

  let rc = 0
  let dc = 0
  return [...byDate.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((e) => {
      rc += e.received
      dc += e.delivered
      return {
        date: e.date,
        receivedCumulative: round2(rc),
        deliveredCumulative: round2(dc),
        gap: round2(rc - dc),
      }
    })
}

export function openOrderBook(l: LedgerT): LedgerRowT[] {
  return l.rows.filter((r) => r.type === 'pending_po')
}

export function flaggedRows(l: LedgerT): LedgerRowT[] {
  return l.rows.filter((r) => r.flags.length > 0)
}

/** PO references appearing on more than one line. */
export function duplicatePoRefs(l: LedgerT): { po: string; rows: number[] }[] {
  const seen = new Map<string, number[]>()
  for (const r of l.rows) {
    if (!r.po_number) continue
    const key = r.po_number.split('-')[0]
    seen.set(key, [...(seen.get(key) ?? []), r.source_row])
  }
  return [...seen.entries()]
    .filter(([, rows]) => rows.length > 1)
    .map(([po, rows]) => ({ po, rows }))
}

export function statementFoots(s: StatementT) {
  const computed = round2(s.lines.reduce((a, l) => a + l.amount, 0))
  return { computed, stated: s.stated_total, ok: Math.abs(computed - s.stated_total) < 0.01 }
}

/**
 * Recurring cost of holding the operation open, taken from a monthly statement.
 * Excludes raw fibre containers, one-off tooling and cargo clearance, insurance
 * instalments, certification and BRC maintenance, and credits.
 */
const NON_RECURRING = [
  /fiber container/i, /tool clearance/i, /cargo clearance/i, /mould/i,
  /insurance/i, /certification/i, /brc maintenance/i, /refund/i, /fedex/i,
]

export function recurringMonthlyCost(s: StatementT) {
  const lines = s.lines.filter(
    (l) => l.amount > 0 && !NON_RECURRING.some((re) => re.test(l.description)),
  )
  return { total: round2(lines.reduce((a, l) => a + l.amount, 0)), lines }
}

export type Coverage = { gaps: string[]; overlaps: string[] }

/** Period gaps and overlaps across the request statements. */
export function statementCoverage(d: StatementsT): Coverage {
  const periods = d.statements
    .filter((s) => s.kind !== 'actuals')
    .map((s) => ({ id: s.id, start: s.period_start, end: s.period_end }))
    .sort((a, b) => a.start.localeCompare(b.start))

  const gaps: string[] = []
  const overlaps: string[] = []
  const day = (iso: string, n: number) => {
    const d2 = new Date(iso + 'T00:00:00Z')
    d2.setUTCDate(d2.getUTCDate() + n)
    return d2.toISOString().slice(0, 10)
  }

  for (let i = 1; i < periods.length; i++) {
    const prev = periods[i - 1]
    const cur = periods[i]
    if (cur.start > day(prev.end, 1)) gaps.push(`${day(prev.end, 1)} to ${day(cur.start, -1)}`)
    if (cur.start <= prev.end) overlaps.push(`${cur.start} to ${prev.end}`)
  }
  return { gaps, overlaps }
}

export function fmt(n: number, dp = 0) {
  return n.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp })
}
