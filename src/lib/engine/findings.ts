import type { LedgerT, StatementsT } from '../schema'
import { fmt, uncoveredAdvance } from './index'

/**
 * The sentence at the top of each tab, assembled from the model.
 *
 * REDESIGN-SPEC section 7: no sentence containing a number is written by hand,
 * because a hand-written one goes stale and is eventually wrong on screen. These
 * are pure functions over the same data the tiles read, so the prose and the
 * figures cannot disagree.
 */
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/** '2026-01' to 'January 2026'. */
export function monthName(period: string): string {
  const [year, month] = period.split('-')
  return `${MONTHS[Number(month) - 1]} ${year}`
}

/**
 * 5,771,014.86 to '5.77m'. Headline prose only. Tables and reconciliations keep
 * full precision, because that is where the tie is proved.
 */
export function millions(n: number): string {
  const text = `$${(Math.abs(n) / 1e6).toFixed(2)}m`
  return n < 0 ? `(${text})` : text
}

export type PositionFinding = {
  received: number
  delivered: number
  uncovered: number
  sentence: string
}

export function positionFinding(l: LedgerT): PositionFinding {
  const received = l.summary.total_received
  const delivered = l.summary.total_delivered
  const uncovered = uncoveredAdvance(l)

  return {
    received,
    delivered,
    uncovered,
    sentence:
      `Polyco has paid ${millions(received)} against ${millions(delivered)} delivered. ` +
      `After every open order and ready container ships, ${millions(uncovered)} is still ` +
      `to be worked off.`,
  }
}

export type SettlementFinding = {
  fromPeriod: string
  months: number
  /** The largest absolute variance inside the run. */
  largestGap: number
  sentence: string
}

/**
 * How long statements have been settling cleanly, read off the run of confirmed
 * reconciliations at the end of the series.
 *
 * The run is bounded by `match_confidence`, which is recorded in the data, not by
 * a tolerance invented here. A threshold in this file would be a business number
 * living in `/src`, which CLAUDE.md does not allow, and it would also be the kind
 * of number that quietly decides what counts as paid.
 */
export function settlementFinding(d: StatementsT): SettlementFinding | null {
  const rows = [...d.reconciliation_to_ledger].sort((a, b) => a.period.localeCompare(b.period))

  let start = rows.length
  while (start > 0 && rows[start - 1].match_confidence === 'confirmed') start--
  const run = rows.slice(start)
  if (run.length === 0) return null

  const largestGap = run.reduce((worst, r) => Math.max(worst, Math.abs(r.variance)), 0)

  return {
    fromPeriod: run[0].period,
    months: run.length,
    largestGap,
    sentence:
      `Every statement since ${monthName(run[0].period)} has been matched to receipts, ` +
      `${run.length} months in a row. The largest gap in that run is $${fmt(largestGap)}.`,
  }
}
