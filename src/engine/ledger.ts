/**
 * Every figure on the PHL/EcoFibre Statement tab comes from here. No React.
 * Same approach as the Funds Requested engine: whole cents, the source's own
 * totals as the authority, and a throw where the rows disagree with them.
 *
 * Convention, stated on the page: money received from Polyco raises the
 * balance, value delivered lowers it. A positive balance is Polyco's money that
 * EcoFibre holds and has not yet delivered as goods.
 *
 * polyco-ledger skill: cargo clearing and freight recharges are already inside
 * delivered value and are never deducted a second time; a date is flagged,
 * never silently corrected; and a date nobody has confirmed is shown as
 * unresolved rather than placed in a month.
 */
import { day, usdWhole } from '../lib/format'
import type { LedgerDisputesT, LedgerRowT, LedgerT } from './ledgerSchema'

export type DateStatus = 'confirmed' | 'missing' | 'disputed'

export type Movement = {
  key: string
  sourceRow: number
  /** A delivery lowers the balance; a receipt raises it. */
  kind: 'delivery' | 'receipt'
  rowType: LedgerRowT['type']
  ref: string | null
  poNumber: string | null
  product: string | null
  cents: number
  /** The date used, only when it is confirmed. */
  date: string | null
  dateStatus: DateStatus
  /** Why the date is not confirmed, in a sentence. */
  dateNote: string | null
  /**
   * A lump-sum receipt tied to no PO. A payment against a PO or a recharge line
   * is attributed to that line. Always false for a delivery.
   */
  unattributed: boolean
}

export type Month = {
  month: string
  deliveredCents: number
  receivedCents: number
  /** Balance at month end, counting only movements with a confirmed date. */
  balanceCents: number
  movements: Movement[]
}

export type Bridge = {
  receivedCents: number
  deliveredCents: number
  rechargesCents: number
  balanceCents: number
  pendingPosCents: number
  containersReadyCents: number
  containersInProcessCents: number
  uncoveredCents: number
}

export type LedgerModel = {
  asAt: string
  bridge: Bridge
  months: Month[]
  /** Movements whose date is missing or disputed, kept out of every month. */
  unresolved: Movement[]
  unresolvedNetCents: number
  /** The balance from the months alone, before the unresolved movements. */
  datedBalanceCents: number
  unattributed: { count: number; cents: number }
  headline: string
}

const toCents = (dollars: number | null) => Math.round((dollars ?? 0) * 100)
const ISO = /^\d{4}-\d{2}-\d{2}$/

export class LedgerDoesNotTie extends Error {}

function resolveDate(
  stored: string | null,
  source: string | null,
  dispute: LedgerDisputesT['disputes'][number] | undefined,
): { date: string | null; status: DateStatus; note: string | null } {
  if (dispute) {
    return {
      date: null,
      status: 'disputed',
      note: `The ledger dates it ${day(dispute.ledger_date)}. ${dispute.other_source} Not yet agreed.`,
    }
  }
  if (!stored) {
    const reads = source && source.trim() !== '-' ? ` The workbook reads "${source}".` : ''
    return { date: null, status: 'missing', note: `No usable date in the workbook.${reads}` }
  }
  if (source && ISO.test(source) && source !== stored) {
    return {
      date: null,
      status: 'disputed',
      note:
        `The workbook reads ${day(source)}, after the statement date, so the day and month were ` +
        `probably swapped on entry, giving ${day(stored)}. Not yet confirmed.`,
    }
  }
  return { date: stored, status: 'confirmed', note: null }
}

function movementsOf(row: LedgerRowT, disputes: LedgerDisputesT['disputes']): Movement[] {
  const out: Movement[] = []
  const base = { sourceRow: row.source_row, rowType: row.type, ref: row.ref, poNumber: row.po_number, product: row.product }

  const delivered = toCents(row.delivered_value)
  if (delivered !== 0) {
    const d = resolveDate(
      row.delivery_date,
      row.delivery_date_source,
      disputes.find((x) => x.source_row === row.source_row && x.movement === 'delivered'),
    )
    out.push({ ...base, key: `${row.source_row}-d`, kind: 'delivery', cents: delivered, date: d.date, dateStatus: d.status, dateNote: d.note, unattributed: false })
  }

  const received = toCents(row.received)
  if (received !== 0) {
    const d = resolveDate(
      row.received_date,
      row.received_date_source,
      disputes.find((x) => x.source_row === row.source_row && x.movement === 'received'),
    )
    out.push({ ...base, key: `${row.source_row}-r`, kind: 'receipt', cents: received, date: d.date, dateStatus: d.status, dateNote: d.note, unattributed: row.type === 'receipt' && row.po_number === null })
  }
  return out
}

const effect = (m: Movement) => (m.kind === 'receipt' ? m.cents : -m.cents)

function monthsBetween(first: string, last: string): string[] {
  const out: string[] = []
  let [y, m] = first.split('-').map(Number)
  const [ly, lm] = last.split('-').map(Number)
  while (y < ly || (y === ly && m <= lm)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`)
    m += 1
    if (m > 12) {
      m = 1
      y += 1
    }
  }
  return out
}

export function buildLedgerModel(ledger: LedgerT, disputes: LedgerDisputesT): LedgerModel {
  const s = ledger.summary
  const movements = ledger.rows.flatMap((row) => movementsOf(row, disputes.disputes))

  const deliveredCents = movements.filter((m) => m.kind === 'delivery').reduce((a, m) => a + m.cents, 0)
  const receivedCents = movements.filter((m) => m.kind === 'receipt').reduce((a, m) => a + m.cents, 0)
  if (deliveredCents !== toCents(s.total_delivered) || receivedCents !== toCents(s.total_received)) {
    throw new LedgerDoesNotTie(
      `Rows give delivered ${deliveredCents} and received ${receivedCents} cents against the workbook's ` +
        `${toCents(s.total_delivered)} and ${toCents(s.total_received)}.`,
    )
  }

  const bridge: Bridge = {
    receivedCents,
    deliveredCents,
    // Information only: already inside delivered value, never deducted again.
    rechargesCents: toCents(s.recharges_included_in_delivered),
    balanceCents: receivedCents - deliveredCents,
    pendingPosCents: toCents(s.pos_pending_to_deliver),
    containersReadyCents: toCents(s.containers_ready_next_month),
    containersInProcessCents: toCents(s.containers_in_process_following_month),
    uncoveredCents: 0,
  }
  bridge.uncoveredCents =
    bridge.balanceCents - bridge.pendingPosCents - bridge.containersReadyCents - bridge.containersInProcessCents
  if (bridge.uncoveredCents !== toCents(s.uncovered_advance)) {
    throw new LedgerDoesNotTie(
      `The uncovered advance works out at ${bridge.uncoveredCents} cents against the workbook's ${toCents(s.uncovered_advance)}.`,
    )
  }

  const dated = movements
    .filter((m) => m.dateStatus === 'confirmed')
    .sort((a, b) => a.date!.localeCompare(b.date!) || a.sourceRow - b.sourceRow)
  const unresolved = movements.filter((m) => m.dateStatus !== 'confirmed')

  let running = 0
  const months: Month[] = monthsBetween(dated[0].date!.slice(0, 7), dated[dated.length - 1].date!.slice(0, 7)).map(
    (month) => {
      const inMonth = dated.filter((m) => m.date!.startsWith(month))
      running += inMonth.reduce((a, m) => a + effect(m), 0)
      return {
        month,
        deliveredCents: inMonth.filter((m) => m.kind === 'delivery').reduce((a, m) => a + m.cents, 0),
        receivedCents: inMonth.filter((m) => m.kind === 'receipt').reduce((a, m) => a + m.cents, 0),
        balanceCents: running,
        movements: inMonth,
      }
    },
  )

  const unresolvedNetCents = unresolved.reduce((a, m) => a + effect(m), 0)
  const unattributed = movements.filter((m) => m.unattributed)

  return {
    asAt: s.as_at,
    bridge,
    months,
    unresolved,
    unresolvedNetCents,
    datedBalanceCents: running,
    unattributed: { count: unattributed.length, cents: unattributed.reduce((a, m) => a + m.cents, 0) },
    headline:
      `Polyco has paid ${usdWhole(receivedCents)} and EcoFibre has delivered ${usdWhole(deliveredCents)}, ` +
      `leaving an uncovered advance of ${usdWhole(bridge.uncoveredCents)} after orders in hand.`,
  }
}
