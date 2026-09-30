/**
 * The live PHL/EcoFibre statement. No React.
 *
 * Three sources, in order of authority:
 *   1. efdashboard.com's PO tracker, the MASTER for which orders exist and
 *      whether and when each was dispatched. A dispatched order is delivered.
 *   2. Changes recorded on this site: payments in, invoices out, corrections.
 *   3. The statement workbook, for values and for history back to 2022.
 *
 * Nothing in the workbook is overwritten. Where it disagrees with the master,
 * the master is followed and the disagreement is listed as a numbered
 * discrepancy, with both readings.
 *
 * Convention: money received from Polyco raises the balance and value delivered
 * lowers it. Cargo clearing, freight and courier recharges are delivered value
 * and are never deducted a second time (polyco-ledger skill).
 */
import { amount, day } from '../lib/format'
import { NO_RULES, type EntryT, type LedgerDisputesT, type StatementRulesT, type WorkbookRowT, type WorkbookT } from './statementSchema'
import type { Tracker, TrackerPo } from './tracker'

export type LineKind = 'order' | 'receipt' | 'recharge' | 'charge'
export type LineStatus = 'delivered' | 'awaiting' | 'on-hold' | 'cancelled' | 'received' | 'invoiced' | 'excluded'
export type DateStatus = 'confirmed' | 'missing' | 'disputed'

export type Line = {
  key: string
  source: 'workbook' | 'recorded'
  row: number | null
  entryId: string | null
  kind: LineKind
  /** A clean name for the line; `ref` keeps the wording as issued. */
  name: string
  ref: string
  product: string | null
  /** efdashboard.com's PO number when matched, otherwise as written. */
  po: string | null
  poAsWritten: string | null
  tracker: TrackerPo | null
  poAmountCents: number
  deliveredCents: number
  receivedCents: number
  /** Order value still to deliver: awaiting dispatch or on hold. */
  openCents: number
  deliveryDate: string | null
  deliveryDateStatus: DateStatus
  receivedDate: string | null
  receivedDateStatus: DateStatus
  dateNote: string | null
  status: LineStatus
  statusNote: string
  /** Where the status came from. */
  statusSource: 'efdashboard.com' | 'workbook' | 'recorded'
  corrections: { entry: EntryT; field: 'delivered' | 'received' | 'po_amount'; fromCents: number }[]
  /** Date, PO or exclusion changes recorded against this line. */
  fixes: EntryT[]
  discrepancies: number[]
}

export type Movement = {
  key: string
  line: Line
  kind: 'delivery' | 'receipt'
  cents: number
  date: string | null
  dateStatus: DateStatus
}

/**
 * A way to settle a discrepancy. Each becomes a signed entry on the statement;
 * the ones that change a figure, a date, a PO or leave a line out change the
 * statement too. Nothing changes the workbook itself.
 */
export type Fix =
  | { type: 'acknowledge'; label: string; hint: string }
  | { type: 'set-value'; label: string; field: 'delivered' | 'received' | 'po_amount'; row: number; suggestions: { label: string; cents: number }[] }
  | { type: 'set-date'; label: string; field: 'received_date' | 'delivery_date'; row: number; suggestions: { label: string; date: string }[] }
  | { type: 'exclude'; label: string; hint: string; row: number }
  | { type: 'assign-po'; label: string; row: number; candidates: string[] }
  | { type: 'add-po'; label: string; po: string }
  | { type: 'upload'; label: string; target: string }

export type Discrepancy = {
  id: number
  /** Stable across reloads, so a fix stays attached to its discrepancy. */
  key: string
  severity: 'high' | 'medium' | 'low'
  title: string
  detail: string
  row: number | null
  po: string | null
  workbook: string | null
  master: string | null
  fixes: Fix[]
  resolved: { entryId: string; by: string; at: string; note: string } | null
}

export type Month = {
  month: string
  deliveredCents: number
  receivedCents: number
  balanceCents: number
  movements: Movement[]
}

export type StatementModel = {
  asAt: string
  lines: Line[]
  months: Month[]
  unresolved: Movement[]
  position: {
    receivedCents: number
    deliveredCents: number
    rechargesCents: number
    balanceCents: number
    awaitingCents: number
    onHoldCents: number
    exposureCents: number
  }
  workbook: {
    file: string
    exposureCents: number | null
    pendingCents: number | null
    containersCents: number | null
  }
  /** Orders on efdashboard.com that the workbook carries no value for. */
  masterOnly: TrackerPo[]
  discrepancies: Discrepancy[]
  /** How many are still open. */
  openDiscrepancies: number
  trackerLive: boolean
}

/* ---- reading cells ---------------------------------------------------- */

const text = (v: string | number | null) => (v === null ? '' : String(v).trim())

function num(v: string | number | null): number | null {
  if (v === null) return null
  if (typeof v === 'number') return v
  const t = v.replace(/[,$\s]/g, '')
  if (!t || t === '-' || /^n\/a$/i.test(t)) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

const toCents = (n: number | null) => Math.round((n ?? 0) * 100)
const ISO = /^\d{4}-\d{2}-\d{2}$/

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
}

function iso(y: number, m: number, d: number): string | null {
  const at = new Date(Date.UTC(y, m - 1, d))
  return at.getUTCFullYear() === y && at.getUTCMonth() === m - 1 && at.getUTCDate() === d ? at.toISOString().slice(0, 10) : null
}

/**
 * A workbook date. A date cell arrives as YYYY-MM-DD and may have its day and
 * month swapped; text is read day first. Anything after the workbook's as-at
 * date, or that reads two ways, is not confirmed.
 */
export type ReadDate = {
  date: string | null
  status: DateStatus
  note: string | null
  /** The other reading of a date cell with a day of 12 or under. */
  swapped: string | null
  /** The date cell exactly as stored, before any day-first reading. */
  stored: string | null
  /** True when the day-first rule chose the reading. */
  dayFirst: boolean
}

/**
 * A workbook date. A date cell arrives as YYYY-MM-DD. With the day-first rule
 * (data/statement-rules.json), a cell with a day of 12 or under is read with day
 * and month swapped, because the dates were typed day first and Excel stored
 * them month first. Text is always read day first. Anything after the
 * workbook's as-at date, or that reads two ways, is not confirmed.
 */
export function readDate(v: string | number | null, asAt: string, dayFirst = false): ReadDate {
  const raw = text(v)
  const none = { swapped: null, stored: null, dayFirst: false }
  if (!raw || raw === '-') return { date: null, status: 'missing', note: 'No date on the workbook.', ...none }
  if (ISO.test(raw)) {
    const [y, m, d] = raw.split('-').map(Number)
    const swapped = d <= 12 && d !== m ? iso(y, d, m) : null
    if (dayFirst && swapped) {
      const note = `The workbook's date cell reads ${day(raw)}; the dates were typed day first, so it is read as ${day(swapped)}.`
      return swapped <= asAt
        ? { date: swapped, status: 'confirmed', note, swapped: raw, stored: raw, dayFirst: true }
        : { date: null, status: 'disputed', note: `${note} That is after the workbook's as-at date of ${day(asAt)}. Not yet confirmed.`, swapped: raw, stored: raw, dayFirst: true }
    }
    if (raw > asAt) {
      return {
        date: null,
        status: 'disputed',
        note: `The workbook reads ${day(raw)}, after its as-at date of ${day(asAt)}${swapped ? `; with day and month swapped it would be ${day(swapped)}` : ''}. Not yet confirmed.`,
        swapped,
        stored: raw,
        dayFirst: false,
      }
    }
    return { date: raw, status: 'confirmed', note: null, swapped, stored: raw, dayFirst: false }
  }
  let m = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/)
  if (m) {
    const y = Number(m[3]) < 100 ? 2000 + Number(m[3]) : Number(m[3])
    const date = iso(y, Number(m[2]), Number(m[1]))
    if (date && date <= asAt) return { date, status: 'confirmed', note: null, ...none }
    return { date: null, status: 'disputed', note: `The workbook reads "${raw}", which is not a usable date.`, ...none }
  }
  m = raw.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,})\s+(\d{4})$/)
  if (m && MONTHS[m[2].slice(0, 3).toLowerCase()]) {
    const date = iso(Number(m[3]), MONTHS[m[2].slice(0, 3).toLowerCase()], Number(m[1]))
    if (date && date <= asAt) return { date, status: 'confirmed', note: null, ...none }
    if (date) return { date: null, status: 'disputed', note: `The workbook reads "${raw}", after its as-at date. Not yet confirmed.`, ...none }
  }
  return { date: null, status: 'missing', note: `The workbook reads "${raw}", which is not a single usable date.`, ...none }
}

/* ---- PO numbers ------------------------------------------------------- */

export type PoRef = { base: string; suffix: string | null; full: string }

/** A PO number from free text: `PO # 2576574- 1 07/12/2025` gives 2576574-1. */
export function readPo(v: string | number | null): PoRef | null {
  const raw = text(v)
  const m = raw.match(/(2\d{6})(?:\s*-\s*(\d{1,2})(?![\d/]))?/)
  if (!m) return null
  return { base: m[1], suffix: m[2] ?? null, full: m[2] ? `${m[1]}-${m[2]}` : m[1] }
}

type Match = { po: TrackerPo; how: 'exact' | 'former' | 'base' }

function matchPo(ref: PoRef, tracker: Tracker): Match | null {
  const exact = tracker.byPo.get(ref.full)
  if (exact) return { po: exact, how: 'exact' }
  const former = tracker.pos.find((p) => p.formerPo === ref.full)
  if (former) return { po: former, how: 'former' }
  const sameBase = tracker.pos.filter((p) => readPo(p.po)?.base === ref.base)
  return sameBase.length === 1 ? { po: sameBase[0], how: 'base' } : null
}

/* ---- classifying a workbook row ----------------------------------------- */

function kindOf(r: WorkbookRowT): LineKind {
  const ref = text(r.ref).toLowerCase()
  if (/^(funds\s*rcvd|overpayment)/.test(ref)) return 'receipt'
  if (/clear|clearnce|freight|courier/.test(ref)) return 'recharge'
  if (/insurance/.test(ref)) return 'charge'
  return 'order'
}

function nameOf(kind: LineKind, r: WorkbookRowT, po: PoRef | null): string {
  const ref = text(r.ref).replace(/\s+/g, ' ')
  if (kind === 'receipt') return /overpayment/i.test(ref) ? 'Overpayment received' : 'Funds received'
  if (kind === 'order') return po ? `PO ${po.full}` : 'Order with no PO number'
  return ref
}

/* ---- the model ---------------------------------------------------------- */

export function buildStatement(
  workbook: WorkbookT,
  tracker: Tracker | null,
  entries: EntryT[],
  disputes: LedgerDisputesT,
  rules: StatementRulesT = NO_RULES,
): StatementModel {
  const asAt = workbook.as_at
  const dayFirst = rules.date_cells_day_first.applies
  let readDayFirst = 0
  const discrepancies: Discrepancy[] = []
  const flag = (d: Omit<Discrepancy, 'id' | 'resolved'>, line?: Line) => {
    const id = discrepancies.length + 1
    discrepancies.push({ id, ...d, resolved: null })
    line?.discrepancies.push(id)
  }
  const ack = (label: string, hint: string): Fix => ({ type: 'acknowledge', label, hint })

  const live = entries.filter((e) => !e.voided)
  const corrections = live.filter((e) => e.kind === 'correction')
  const fixFor = (row: number, field: EntryT['field']) =>
    [...corrections].filter((c) => c.row === row && c.field === field).sort((a, b) => a.at.localeCompare(b.at)).pop() ?? null
  /** The PO a workbook line refers to: as written, unless a fix assigned one. */
  const refOf = (r: WorkbookRowT) => {
    const assigned = fixFor(r.row, 'po')
    return assigned?.value ? readPo(assigned.value) : readPo(r.ref)
  }

  // Which workbook line gets each master PO: the best match wins, so one
  // dispatch is never counted twice.
  const claims = new Map<string, { row: number; how: Match['how'] }>()
  const rank = { exact: 0, former: 1, base: 2 } as const
  if (tracker) {
    for (const r of workbook.rows) {
      if (kindOf(r) !== 'order' || fixFor(r.row, 'exclude')) continue
      const ref = refOf(r)
      const m = ref && matchPo(ref, tracker)
      if (!m) continue
      const held = claims.get(m.po.po)
      if (!held || rank[m.how] < rank[held.how]) claims.set(m.po.po, { row: r.row, how: m.how })
    }
  }

  const lines: Line[] = []
  /** Dispatched POs delivered at a value other than the PO value: normal, containers ship by actual quantity. */
  const variance: Line[] = []
  const brokenSerials: number[] = []

  for (const r of workbook.rows) {
    const kind = kindOf(r)
    const ref = kind === 'order' ? refOf(r) : readPo(r.ref)
    const po = kind === 'order' || kind === 'recharge' ? ref : null
    const match = kind === 'order' && po && tracker ? matchPo(po, tracker) : null
    const owns = match ? claims.get(match.po.po)?.row === r.row : false
    const t = match && owns ? match.po : null

    const poAmount = toCents(num(r.po_amount))
    const g = num(r.delivered)
    const h = num(r.received)
    const loaded = text(r.loaded)
    const recv = readDate(r.received_date, asAt, dayFirst)
    const deliv = readDate(r.delivery_date, asAt, dayFirst)
    if (recv.dayFirst) readDayFirst += 1
    if (deliv.dayFirst) readDayFirst += 1

    const line: Line = {
      key: `row-${r.row}`,
      source: 'workbook',
      row: r.row,
      entryId: null,
      kind,
      name: nameOf(kind, r, po),
      ref: text(r.ref).replace(/\s+/g, ' '),
      product: text(r.product).replace(/\s+/g, ' ') || null,
      po: t ? t.po : po?.full ?? null,
      poAsWritten: po?.full ?? null,
      tracker: t,
      poAmountCents: poAmount,
      deliveredCents: toCents(g),
      receivedCents: toCents(h),
      openCents: 0,
      deliveryDate: deliv.date,
      deliveryDateStatus: deliv.status,
      receivedDate: recv.date,
      receivedDateStatus: recv.status,
      dateNote: null,
      status: kind === 'receipt' ? 'received' : 'delivered',
      statusNote: '',
      statusSource: 'workbook',
      corrections: [],
      fixes: [],
      discrepancies: [],
    }

    // Left out by a fix: kept on the statement, counted nowhere.
    const excluded = fixFor(r.row, 'exclude')
    if (excluded) {
      line.status = 'excluded'
      line.statusNote = `Left out by ${excluded.by}: ${excluded.description}`
      line.deliveredCents = 0
      line.receivedCents = 0
      line.poAmountCents = 0
      line.fixes.push(excluded)
      lines.push(line)
      continue
    }
    const assignedPo = fixFor(r.row, 'po')
    if (assignedPo) line.fixes.push(assignedPo)

    if (kind === 'order') {
      if (t) {
        line.statusSource = 'efdashboard.com'
        if (t.isDispatched) {
          line.status = 'delivered'
          line.deliveredCents = g !== null && g !== 0 ? toCents(g) : poAmount
          line.deliveryDate = t.dispatchDate
          line.deliveryDateStatus = t.dispatchDate ? 'confirmed' : 'missing'
          line.statusNote = t.dispatchDate ? `Dispatched ${day(t.dispatchDate)}` : 'Dispatched'
          if (g === null || g === 0) {
            flag({
              severity: 'high',
              title: /^yes/i.test(loaded)
                ? `PO ${t.po} is marked loaded but has no delivered value`
                : `PO ${t.po} is dispatched, but the workbook still shows it as not delivered`,
              detail: `efdashboard.com shows it dispatched${t.dispatchDate ? ` on ${day(t.dispatchDate)}` : ''}; the workbook reads "${loaded || 'blank'}" with no delivered value. This statement counts it as delivered at its PO value of ${amount(poAmount)} until an invoice is recorded.`,
              row: r.row, po: t.po, workbook: loaded || 'not delivered', master: t.dispatchDate ? `Dispatched ${day(t.dispatchDate)}` : 'Dispatched',
              key: `no-delivered-value:row-${r.row}`,
              fixes: [
                { type: 'set-value', label: 'Enter the delivered value', field: 'delivered', row: r.row, suggestions: [{ label: 'PO value', cents: poAmount }] },
                ack('Accept the PO value', `Confirms ${amount(poAmount)} as the delivered value.`),
              ],
            }, line)
          }
          const wbDate = readDate(r.delivery_date, '9999-12-31', dayFirst)
          // Either reading of the cell agreeing with efdashboard.com is agreement.
          if (t.dispatchDate && wbDate.date && wbDate.date !== t.dispatchDate && wbDate.stored !== t.dispatchDate) {
            const swappedMatch = wbDate.swapped === t.dispatchDate
            flag({
              severity: 'medium',
              title: `PO ${t.po}: dispatch date differs`,
              detail: swappedMatch
                ? `The workbook reads ${day(wbDate.date)}: the dispatch date with day and month swapped.`
                : `The workbook reads ${day(wbDate.date)}; efdashboard.com says ${day(t.dispatchDate)}.`,
              row: r.row, po: t.po, workbook: day(wbDate.date), master: day(t.dispatchDate),
              key: `dispatch-date:row-${r.row}`,
              fixes: [
                ack(`Use efdashboard.com's date, ${day(t.dispatchDate)}`, 'Marks the workbook date as wrong. The statement already uses this date.'),
                { type: 'set-date', label: 'Use another date', field: 'delivery_date', row: r.row, suggestions: [{ label: 'Workbook date', date: wbDate.date }] },
              ],
            }, line)
          }
        } else if (t.state.key === 'cancelled') {
          line.status = 'cancelled'
          line.deliveredCents = 0
          line.statusNote = 'Cancelled'
        } else {
          line.status = t.isInactive ? 'on-hold' : 'awaiting'
          line.deliveredCents = 0
          line.deliveryDate = null
          line.openCents = poAmount
          line.statusNote = t.state.label
          if ((g ?? 0) !== 0 || /^yes/i.test(loaded)) {
            flag({
              severity: 'high',
              title: `PO ${t.po} is not dispatched, but the workbook counts it as delivered`,
              detail: `efdashboard.com shows "${t.state.label}"; the workbook reads "${loaded}" with ${amount(toCents(g))} delivered. This statement follows efdashboard.com.`,
              row: r.row, po: t.po, workbook: loaded, master: t.state.label,
              key: `not-dispatched:row-${r.row}`,
              fixes: [ack("Follow efdashboard.com", 'Confirms the order is not yet delivered.')],
            }, line)
          }
        }
        if (po && po.full !== t.po) {
          const renamed = t.formerPo === po.full
          flag({
            severity: renamed ? 'medium' : 'low',
            title: renamed ? `PO ${po.full} is now PO ${t.po}` : `PO number written differently: ${po.full} against ${t.po}`,
            detail: renamed
              ? `efdashboard.com lists PO ${t.po} as the former PO ${po.full}. The workbook still uses the old number.`
              : `The workbook writes "${line.ref}"; efdashboard.com's number is ${t.po}. Matched on the base number ${po.base}.`,
            row: r.row, po: t.po, workbook: po.full, master: t.po,
            key: `po-number:row-${r.row}`,
            fixes: [ack(`Use PO ${t.po}`, "Accepts efdashboard.com's number; the workbook should be updated to match.")],
          }, line)
        }
        if (g !== null && g !== 0 && poAmount !== 0 && toCents(g) !== poAmount && t.isDispatched) variance.push(line)
      } else {
        // Not on efdashboard.com, or another workbook line holds that PO: the
        // workbook's own status stands.
        if (match && !owns && /^no\b/i.test(loaded)) {
          flag({
            severity: 'low',
            title: `${po!.full} was adjusted to another PO`,
            detail: `The workbook reads "${loaded}". efdashboard.com carries the order as PO ${match.po.po}. This line is left out of every total.`,
            row: r.row, po: match.po.po, workbook: loaded, master: match.po.po,
            key: `adjusted:row-${r.row}`,
            fixes: [ack('Agree', 'Confirms the line was replaced by the other PO.')],
          }, line)
        } else if (match && !owns) {
          const winner = claims.get(match.po.po)!
          flag({
            severity: 'high',
            title: `Possible duplicate: ${po!.full} and row ${winner.row} both match PO ${match.po.po}`,
            detail: `efdashboard.com has one order, PO ${match.po.po}${match.po.formerPo ? ` (formerly ${match.po.formerPo})` : ''}, ${match.po.state.label.toLowerCase()}. The workbook carries it on two lines. This line keeps the workbook's own status until one is removed.`,
            row: r.row, po: match.po.po, workbook: `${po!.full}: ${loaded || 'blank'}`, master: `${match.po.po}: ${match.po.state.label}`,
            key: `duplicate:row-${r.row}`,
            fixes: [
              { type: 'exclude', label: 'Leave this line out as a duplicate', hint: `Row ${r.row} stops counting; row ${winner.row} carries the order.`, row: r.row },
              ...(tracker
                ? [{ type: 'assign-po' as const, label: 'It is a different order: assign its PO', row: r.row, candidates: tracker.pos.filter((p) => !p.isInternal).map((p) => p.po) }]
                : []),
            ],
          }, line)
        }
        if (/^yes/i.test(loaded) || (g ?? 0) !== 0) {
          line.status = 'delivered'
          line.statusNote = 'Delivered, per the workbook'
        } else if (/^no\b/i.test(loaded)) {
          line.status = 'cancelled'
          line.statusNote = loaded
        } else {
          line.status = /hold|pending/i.test(loaded) ? 'on-hold' : 'awaiting'
          line.openCents = poAmount
          line.statusNote = loaded || 'Not delivered'
        }
        if (!po) {
          flag({
            severity: 'high',
            title: `Row ${r.row} has no PO number`,
            detail: `The PO column reads "${line.ref}" for ${line.product ?? 'an order'} at ${amount(poAmount)}, delivered ${line.deliveryDate ? day(line.deliveryDate) : 'on no clear date'}.`,
            row: r.row, po: null, workbook: line.ref, master: null,
            key: `no-po:row-${r.row}`,
            fixes: [
              { type: 'assign-po', label: 'Assign the PO', row: r.row, candidates: tracker ? tracker.pos.filter((p) => !p.isInternal).map((p) => p.po) : [] },
              { type: 'exclude', label: 'Leave this line out', hint: 'For a copy of another line.', row: r.row },
            ],
          }, line)
        }
      }
    }

    if (kind === 'recharge' || kind === 'charge') {
      if (po && tracker) {
        const m = matchPo(po, tracker)
        if (m) {
          line.tracker = m.po
          line.po = m.po.po
        }
      }
      if (!line.deliveredCents) line.deliveredCents = poAmount
      line.status = 'invoiced'
      line.statusNote = /invoice pending/i.test(text(r.proforma)) ? 'Invoice pending' : 'Recharged to Polyco'
      if (/invoice pending/i.test(text(r.proforma))) {
        flag({
          severity: 'medium',
          title: `Row ${r.row}: invoice not yet issued`,
          detail: `"${line.ref}" at ${amount(line.deliveredCents)} is counted as delivered, but the invoice column reads "Invoice Pending".`,
          row: r.row, po: line.po, workbook: 'Invoice Pending', master: null,
          key: `invoice-pending:row-${r.row}`,
          fixes: [
            { type: 'upload', label: 'Upload the invoice', target: `row-${r.row}` },
            ack('Mark as invoiced', 'Confirms the invoice has been issued to Polyco.'),
          ],
        }, line)
      }
    }

    // A receipt date another document contradicts.
    const dispute = disputes.disputes.find((d) => d.source_row === r.row && d.movement === 'received')
    const receivedFix = fixFor(r.row, 'received_date')
    const deliveryFix = fixFor(r.row, 'delivery_date')
    if (receivedFix?.value) {
      line.receivedDate = receivedFix.value
      line.receivedDateStatus = 'confirmed'
      line.fixes.push(receivedFix)
    } else if (dispute) {
      line.receivedDate = null
      line.receivedDateStatus = 'disputed'
      line.dateNote = `The workbook dates it ${day(recv.date ?? dispute.ledger_date)}${recv.dayFirst ? ' (read day first)' : ''}. ${dispute.other_source}`
    } else if (line.receivedCents && line.receivedDateStatus !== 'confirmed') {
      line.dateNote = recv.note
    } else if (line.deliveredCents && line.deliveryDateStatus !== 'confirmed') {
      line.dateNote = deliv.note
    }
    if (!line.dateNote && (recv.dayFirst || deliv.dayFirst)) line.dateNote = (recv.dayFirst ? recv.note : deliv.note)
    if (deliveryFix?.value) {
      line.deliveryDate = deliveryFix.value
      line.deliveryDateStatus = 'confirmed'
      line.fixes.push(deliveryFix)
    }
    if (line.receivedCents && (line.receivedDateStatus !== 'confirmed' || receivedFix)) {
      const options = [
        ...(dispute ? [{ label: 'Other document', date: dispute.other_date }] : []),
        ...(recv.date ? [{ label: recv.dayFirst ? 'Workbook, read day first' : 'Workbook', date: recv.date }] : []),
        ...(recv.swapped && recv.swapped !== recv.date && recv.swapped <= asAt ? [{ label: recv.dayFirst ? 'Workbook, as stored' : 'Day and month swapped', date: recv.swapped }] : []),
      ]
      flag({
        severity: 'medium',
        title: `Row ${r.row}: receipt of ${amount(line.receivedCents)} has ${line.receivedDateStatus === 'missing' ? 'no usable date' : 'a disputed date'}`,
        detail: line.dateNote ?? '',
        row: r.row, po: null, workbook: text(r.received_date) || 'blank', master: null,
        key: `receipt-date:row-${r.row}`,
        fixes: [
          { type: 'set-date', label: 'Set the date received', field: 'received_date', row: r.row, suggestions: options },
          ack('Leave it undated', 'It keeps counting in every total, outside any month.'),
        ],
      }, line)
    }

    // Wording and reference problems, one per row.
    if (text(r.sno) === '#REF!') brokenSerials.push(r.row)
    if (po && /\d-\d+-\d/.test(line.ref)) {
      flag({ severity: 'low', title: `Row ${r.row}: PO reference "${line.ref}" has an extra suffix`, detail: `Read as ${po.full}.`, row: r.row, po: line.po, workbook: line.ref, master: line.po, key: `ref-suffix:row-${r.row}`, fixes: [ack(`Read it as ${po.full}`, 'The workbook should be corrected to match.')] }, line)
    }
    if (po && /2\d{6}\d/.test(line.ref)) {
      flag({ severity: 'low', title: `Row ${r.row}: PO number run into its date`, detail: `"${line.ref}" is read as PO ${po.full}.`, row: r.row, po: line.po, workbook: line.ref, master: line.po, key: `ref-date:row-${r.row}`, fixes: [ack(`Read it as PO ${po.full}`, 'The workbook should be corrected to match.')] }, line)
    }
    const k = num(r.delivered_k)
    if (k !== null && g !== null && toCents(k) !== toCents(g)) {
      flag({
        severity: 'low',
        title: `Row ${r.row}: the two delivered-value columns disagree`,
        detail: `Column G reads ${amount(toCents(g))}; column K reads ${amount(toCents(k))}. Column G is used.`,
        row: r.row, po: line.po, workbook: `G ${amount(toCents(g))} / K ${amount(toCents(k))}`, master: null,
        key: `columns:row-${r.row}`,
        fixes: [
          { type: 'set-value', label: 'Choose the delivered value', field: 'delivered', row: r.row, suggestions: [{ label: 'Column G', cents: toCents(g) }, { label: 'Column K', cents: toCents(k) }] },
        ],
      }, line)
    }

    // Corrections recorded on this site.
    for (const c of corrections.filter((c) => c.row === r.row && (c.field === 'delivered' || c.field === 'received' || c.field === 'po_amount'))) {
      const field = c.field as 'delivered' | 'received' | 'po_amount'
      const key = field === 'delivered' ? 'deliveredCents' : field === 'received' ? 'receivedCents' : 'poAmountCents'
      line.corrections.push({ entry: c, field, fromCents: line[key] })
      line[key] = toCents(c.amount)
      if (field === 'po_amount' && line.openCents) line.openCents = line.poAmountCents
    }

    lines.push(line)
  }

  // Payments and invoices recorded on this site.
  for (const e of live.filter((e) => e.kind !== 'correction')) {
    const payment = e.kind === 'payment'
    const t = e.po && tracker ? tracker.byPo.get(e.po) ?? null : null
    lines.push({
      key: `entry-${e.id}`,
      source: 'recorded',
      row: null,
      entryId: e.id,
      kind: payment ? 'receipt' : e.invoiceKind === 'recharge' ? 'recharge' : e.invoiceKind === 'goods' ? 'order' : 'charge',
      name: payment ? 'Payment received' : e.invoiceKind === 'goods' ? `Invoice${e.po ? `, PO ${e.po}` : ''}` : e.description,
      ref: e.reference ?? e.description,
      product: payment ? null : e.description,
      po: e.po,
      poAsWritten: e.po,
      tracker: t,
      poAmountCents: 0,
      deliveredCents: payment ? 0 : toCents(e.amount),
      receivedCents: payment ? toCents(e.amount) : 0,
      openCents: 0,
      deliveryDate: payment ? null : e.date,
      deliveryDateStatus: 'confirmed',
      receivedDate: payment ? e.date : null,
      receivedDateStatus: 'confirmed',
      dateNote: null,
      status: payment ? 'received' : 'invoiced',
      statusNote: `Recorded by ${e.by}`,
      statusSource: 'recorded',
      corrections: [],
      fixes: [],
      discrepancies: [],
    })
  }

  // POs efdashboard.com has and the workbook did not, added by a fix.
  if (tracker) {
    for (const c of corrections.filter((c) => c.row === null && c.field === 'po_amount' && c.po)) {
      const t = tracker.byPo.get(c.po!)
      if (!t || lines.some((l) => l.source === 'recorded' && l.entryId === c.id)) continue
      const value = toCents(c.amount)
      const dispatched = t.isDispatched
      lines.push({
        key: `entry-${c.id}`, source: 'recorded', row: null, entryId: c.id, kind: 'order', name: `PO ${t.po}`,
        ref: `PO ${t.po}`, product: t.product, po: t.po, poAsWritten: t.po, tracker: t, poAmountCents: value,
        deliveredCents: dispatched ? value : 0, receivedCents: 0,
        openCents: dispatched || t.state.key === 'cancelled' ? 0 : value,
        deliveryDate: dispatched ? t.dispatchDate : null, deliveryDateStatus: dispatched && t.dispatchDate ? 'confirmed' : 'missing',
        receivedDate: null, receivedDateStatus: 'confirmed', dateNote: null,
        status: dispatched ? 'delivered' : t.state.key === 'cancelled' ? 'cancelled' : t.isInactive ? 'on-hold' : 'awaiting',
        statusNote: dispatched ? `Dispatched ${t.dispatchDate ? day(t.dispatchDate) : ''}`.trim() : t.state.label,
        statusSource: 'efdashboard.com', corrections: [], fixes: [c], discrepancies: [],
      })
    }
  }

  if (brokenSerials.length) {
    flag({
      severity: 'low',
      title: `${brokenSerials.length} rows have a broken serial number (#REF!)`,
      detail: `Rows ${brokenSerials[0]} to ${brokenSerials[brokenSerials.length - 1]} show #REF! in the S.No. column, so the newest entries are unnumbered on the workbook.`,
      row: brokenSerials[0], po: null, workbook: '#REF!', master: null,
      key: 'broken-serials',
      fixes: [ack('Noted: fix the serial numbers in the workbook', 'Does not change any figure.')],
    })
  }

  // Two order lines with the same value and delivery date: one is likely a copy.
  const orders = lines.filter((l) => l.kind === 'order' && l.source === 'workbook' && l.status !== 'excluded' && l.deliveredCents && l.deliveryDate)
  for (const l of orders) {
    const twin = orders.find((o) => o !== l && o.row! < l.row! && !(o.tracker && l.tracker) && o.deliveredCents === l.deliveredCents && o.deliveryDate === l.deliveryDate && o.po !== l.po)
    if (twin) {
      flag({
        severity: 'high',
        title: `Row ${l.row} may duplicate row ${twin.row}`,
        detail: `Both are ${amount(l.deliveredCents)} delivered on ${day(l.deliveryDate!)}: "${twin.ref}" and "${l.ref}". If one is a copy, the delivered total is overstated by ${amount(l.deliveredCents)}.`,
        row: l.row, po: l.po, workbook: `${twin.ref} / ${l.ref}`, master: twin.po,
        key: `twin:row-${l.row}`,
        fixes: [
          { type: 'exclude', label: `Leave row ${l.row} out as a copy`, hint: `Takes ${amount(l.deliveredCents)} off delivered value.`, row: l.row! },
          ack('Not a copy: keep both', 'Both lines keep counting.'),
        ],
      }, l)
    }
  }

  if (variance.length) {
    const net = variance.reduce((a, l) => a + l.deliveredCents - l.poAmountCents, 0)
    flag({
      severity: 'low',
      title: `${variance.length} dispatched POs were delivered at a value other than their PO value`,
      detail: `Normal when a container ships a different quantity from the order. Net difference ${amount(net)} across them; each PO shows its own PO and delivered values. The delivered value is what counts.`,
      row: null, po: null, workbook: null, master: null,
      key: 'value-variance',
      fixes: [ack('Noted', 'Delivered values stand; nothing changes.')],
    })
  }

  // Orders on efdashboard.com the workbook has no line for.
  const claimed = new Set(claims.keys())
  const masterOnly = tracker
    ? tracker.pos.filter(
        (p) =>
          !claimed.has(p.po) &&
          !p.isInternal &&
          p.state.key !== 'cancelled' &&
          !lines.some((l) => l.source === 'recorded' && l.po === p.po) &&
          (!p.isDispatched || (p.dispatchDate ?? '') >= '2025-01-01'),
      )
    : []
  for (const p of masterOnly) {
    flag({
      severity: p.isDispatched ? 'high' : p.state.key === 'po-pending' ? 'low' : 'medium',
      title: `PO ${p.po} is on efdashboard.com but not on the workbook`,
      detail: `${p.product}, ${p.state.label.toLowerCase()}${p.dispatchDate ? ` ${day(p.dispatchDate)}` : ''}. The workbook carries no value for it, so it is not in the exposure figure. Record its invoice to bring it in.`,
      row: null, po: p.po, workbook: 'Missing', master: p.state.label,
      key: `missing-po:${p.po}`,
      fixes: [
        { type: 'add-po', label: 'Add it to the statement with its value', po: p.po },
        ack('Leave it off the statement', 'For an order that is not part of the Polyco account.'),
      ],
    })
  }

  // Movements, months and the unresolved.
  const movements: Movement[] = []
  for (const l of lines) {
    if (l.deliveredCents) movements.push({ key: `${l.key}-d`, line: l, kind: 'delivery', cents: l.deliveredCents, date: l.deliveryDateStatus === 'confirmed' ? l.deliveryDate : null, dateStatus: l.deliveryDateStatus })
    if (l.receivedCents) movements.push({ key: `${l.key}-r`, line: l, kind: 'receipt', cents: l.receivedCents, date: l.receivedDateStatus === 'confirmed' ? l.receivedDate : null, dateStatus: l.receivedDateStatus })
  }
  const dated = movements.filter((m) => m.date).sort((a, b) => a.date!.localeCompare(b.date!) || a.key.localeCompare(b.key))
  const unresolved = movements.filter((m) => !m.date)
  const effect = (m: Movement) => (m.kind === 'receipt' ? m.cents : -m.cents)

  const months: Month[] = []
  if (dated.length) {
    let running = 0
    let [y, mo] = dated[0].date!.slice(0, 7).split('-').map(Number)
    const last = dated[dated.length - 1].date!.slice(0, 7)
    for (;;) {
      const key = `${y}-${String(mo).padStart(2, '0')}`
      const inMonth = dated.filter((m) => m.date!.startsWith(key))
      running += inMonth.reduce((a, m) => a + effect(m), 0)
      months.push({
        month: key,
        deliveredCents: inMonth.filter((m) => m.kind === 'delivery').reduce((a, m) => a + m.cents, 0),
        receivedCents: inMonth.filter((m) => m.kind === 'receipt').reduce((a, m) => a + m.cents, 0),
        balanceCents: running,
        movements: inMonth,
      })
      if (key === last) break
      mo += 1
      if (mo > 12) { mo = 1; y += 1 }
    }
  }

  const sum = (f: (l: Line) => number) => lines.reduce((a, l) => a + f(l), 0)
  const receivedCents = sum((l) => l.receivedCents)
  const deliveredCents = sum((l) => l.deliveredCents)
  const awaitingCents = sum((l) => (l.status === 'awaiting' ? l.openCents : 0))
  const onHoldCents = sum((l) => (l.status === 'on-hold' ? l.openCents : 0))
  const balanceCents = receivedCents - deliveredCents
  const exposureCents = balanceCents - awaitingCents - onHoldCents

  // The workbook's own summary, checked against its rows.
  const lineValue = (re: RegExp) => {
    const s = workbook.summary.find((x) => x.kind === 'line' && re.test(x.label))
    return s && s.kind === 'line' ? num(s.value) : null
  }
  const wbExposure = lineValue(/^exposure/i)
  const wbPending = lineValue(/pending to deliver/i)
  const wbContainers = lineValue(/^containers ready/i)
  const wbOpen = workbook.rows
    .filter((r) => kindOf(r) === 'order')
    .filter((r) => !/^yes/i.test(text(r.loaded)) && !(num(r.delivered) ?? 0) && !/^no\b/i.test(text(r.loaded)))
    .reduce((a, r) => a + toCents(num(r.po_amount)), 0)
  if (wbPending !== null && toCents(wbPending) !== wbOpen) {
    flag({
      severity: 'medium',
      title: 'Workbook: "Total Value of POs Pending to Deliver" does not match its rows',
      detail: `The summary line reads ${amount(toCents(wbPending))}; the undelivered PO rows on the workbook add up to ${amount(wbOpen)}, a difference of ${amount(toCents(wbPending) - wbOpen)}.`,
      row: null, po: null, workbook: amount(toCents(wbPending)), master: amount(wbOpen),
      key: 'workbook-pending-total',
      fixes: [ack('Noted: correct the workbook total', 'The live statement counts open orders from efdashboard.com.')],
    })
  }
  for (const s of workbook.summary) {
    if (s.kind === 'line' && /containers/i.test(s.label)) {
      flag({
        severity: 'medium',
        title: `Workbook: "${s.label.replace(/\s*\(.*$/, '')}" ${s.value === null ? 'has no value' : 'cannot be traced to rows'}`,
        detail:
          s.value === null
            ? 'The line is labelled but left blank.'
            : `It deducts ${amount(toCents(num(s.value)))} for containers "for delivery in August", which no workbook row identifies. This statement counts undelivered orders from efdashboard.com instead and does not deduct this line.`,
        row: s.row, po: null, workbook: s.value === null ? 'blank' : amount(toCents(num(s.value))), master: null,
        key: `workbook-summary:row-${s.row}`,
        fixes: [ack('Noted: remove or fix the line in the workbook', 'The live statement does not deduct it.')],
      })
    }
  }
  if (wbExposure !== null && toCents(wbExposure) !== exposureCents) {
    flag({
      severity: 'high',
      title: 'Workbook exposure differs from the live figure',
      detail: `The workbook states ${amount(toCents(wbExposure))}; with efdashboard.com as master and recorded changes applied, the live figure is ${amount(exposureCents)}, a difference of ${amount(toCents(wbExposure) - exposureCents)}.`,
      row: null, po: null, workbook: amount(toCents(wbExposure)), master: amount(exposureCents),
      key: 'workbook-exposure',
      fixes: [ack('Agree the live figure', `Accepts ${amount(exposureCents)} as the exposure.`)],
    })
  }

  // The day-first rule, on the list as a settled decision with its evidence.
  if (dayFirst && readDayFirst) {
    const r = rules.date_cells_day_first
    flag({
      severity: 'low',
      title: `${readDayFirst} workbook dates were typed day first, and are read that way`,
      detail: r.evidence,
      row: null, po: null, workbook: 'Month first', master: 'Day first',
      key: 'rule:dates-day-first',
      fixes: [],
    })
    discrepancies[discrepancies.length - 1].resolved = { entryId: '', by: r.confirmed_by, at: `${r.confirmed_on}T00:00:00Z`, note: 'Confirmed rule: dates in the workbook were typed day first.' }
  }

  // Settled discrepancies: the latest live entry that names each one.
  const settling = [...live].filter((e) => e.key).sort((a, b) => a.at.localeCompare(b.at))
  for (const d of discrepancies) {
    const e = settling.filter((x) => x.key === d.key).pop()
    if (e) d.resolved = { entryId: e.id, by: e.by, at: e.at, note: e.description }
  }
  // A fix can remove the cause altogether (a line left out). The discrepancy it
  // settled stays on the list as a record, under the title it had.
  const seen = new Set(discrepancies.map((d) => d.key))
  for (const e of settling.reverse()) {
    if (!e.key || seen.has(e.key)) continue
    seen.add(e.key)
    discrepancies.push({
      id: discrepancies.length + 1, key: e.key, severity: 'low', title: e.reference ?? e.key,
      detail: 'Fixed: the cause no longer appears on the statement.', row: e.row, po: e.po,
      workbook: null, master: null, fixes: [], resolved: { entryId: e.id, by: e.by, at: e.at, note: e.description },
    })
  }

  return {
    asAt,
    lines,
    months,
    unresolved,
    position: {
      receivedCents,
      deliveredCents,
      rechargesCents: sum((l) => (l.kind === 'recharge' ? l.deliveredCents : 0)),
      balanceCents,
      awaitingCents,
      onHoldCents,
      exposureCents,
    },
    workbook: {
      file: workbook.file,
      exposureCents: wbExposure === null ? null : toCents(wbExposure),
      pendingCents: wbPending === null ? null : toCents(wbPending),
      containersCents: wbContainers === null ? null : toCents(wbContainers),
    },
    masterOnly,
    discrepancies,
    openDiscrepancies: discrepancies.filter((d) => !d.resolved).length,
    trackerLive: tracker !== null,
  }
}
