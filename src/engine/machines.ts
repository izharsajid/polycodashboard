/**
 * The machines, from the plan alone. No React.
 *
 * Every machine follows data/machine-plan.json, typed from the Production
 * Machine Flow workbook's Thermoforming and Finishing Department sheets: what
 * each runs, from when, until when, when it stops, and the POs the sheets list
 * against each run. efdashboard.com supplies each named PO's status and
 * quantities, and the open orders no run names.
 */
import { z } from 'zod'
import type { Tracker, TrackerPo } from './tracker'

const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

/** What the sheets list against a run, in their own words. */
const PlanOrder = z.union([
  z.object({ po: z.string().regex(/^\d{7}(-\d{1,2})?$/), note: z.string().optional() }).strict(),
  /** "PO Required": work planned for a PO not yet received, and how many the sheet lists. */
  z.object({ po_required: z.number().int().positive() }).strict(),
  /** Work made with no PO: an extra container, the monthly Potato tray. */
  z.object({ no_po: z.string().min(1) }).strict(),
])

export const MachinePlan = z.object({
  source: z.string(),
  as_at: IsoDate,
  note: z.string(),
  machines: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      type: z.enum(['forming', 'lamination', 'trimming', 'xray']),
      /** `unscheduled`: the machine exists but the plan gives it no runs yet. */
      status: z.enum(['running', 'maintenance', 'changing', 'stopped', 'offline', 'unscheduled']),
      runs: z.array(
        z.object({
          product: z.string(),
          from: IsoDate.nullable(),
          until: IsoDate.nullable(),
          orders: z.array(PlanOrder),
          /** Product codes the run makes, to pick its line from a PO that orders several products. */
          codes: z.array(z.string()).optional(),
          /** The machine stands idle after this run's last day, `until`. */
          stops_after: z.boolean().optional(),
          note: z.string().optional(),
        }),
      ),
      stops: IsoDate.nullable(),
      stop_note: z.string().nullable(),
      note: z.string().nullable(),
    }),
  ),
})
export type MachinePlanT = z.infer<typeof MachinePlan>

export type MachineType = MachinePlanT['machines'][number]['type']
export type MachineStatus = MachinePlanT['machines'][number]['status']

/** Product families, for colour: one hue per family wherever it appears. */
export type Family = 'medical' | 'platinum' | 'oasis' | 'pointfive' | 'destiny' | 'halfm' | 'other'

export function familyOf(product: string): Family {
  const p = product.toLowerCase()
  if (/medical|phtrasc|clamshell/.test(p)) return 'medical'
  if (/platinum|tfpp/.test(p)) return 'platinum'
  if (/oasis|ot1230|ot1530/.test(p)) return 'oasis'
  if (/point\s?five|pointfive|every table/.test(p)) return 'pointfive'
  // The Potato tray is the Destiny 7x7 tray (TFTRA7X7) on the finishing sheet.
  if (/7x7|destiny|tftra7x7|potato/.test(p)) return 'destiny'
  if (/1\/2\s?m\b/.test(p)) return 'halfm'
  return 'other'
}

/** One product however the sheets write it: `Oasis Tray #1`, `Oasis Tray`; `Platinum C2`, `Platinum 2`. */
export const productKey = (product: string) =>
  product
    .toLowerCase()
    .replace(/#\d+/g, '')
    .replace(/\bc(\d)\b/g, '$1')
    .replace(/\btrays?\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()

/** A product's name without the machine number some sheets add: `Oasis Tray #2` is `Oasis Tray`. */
export const productName = (product: string) => product.replace(/\s*#\d+$/, '')

export type Quantity = { label: string; quantity: string }

export type Order =
  /** `ref` is the PO as the sheet writes it; `po` is efdashboard.com's order, if found. */
  | { kind: 'po'; ref: string; note: string | null; po: TrackerPo | null; quantities: Quantity[] }
  | { kind: 'required'; count: number }
  | { kind: 'no-po'; text: string }

export type MachineRef = { id: string; name: string }

export type Run = {
  product: string
  family: Family
  from: string | null
  until: string | null
  orders: Order[]
  /** Forming machines making the same product at the same time, for a finishing run with no PO of its own. */
  alongside: MachineRef[]
  stopsAfter: boolean
  note: string | null
}

export type Machine = {
  id: string
  name: string
  type: MachineType
  status: MachineStatus
  runs: Run[]
  stops: string | null
  stopNote: string | null
  note: string | null
}

export type MachinesModel = {
  asAt: string
  source: string
  machines: Machine[]
  months: string[]
  /** The whole span the months cover, first day to last, for the Gantt chart. */
  range: { from: string; to: string }
  /** Open POs on efdashboard.com that no run on the plan names. */
  unplanned: TrackerPo[]
  /** False when efdashboard.com could not be read, so no PO has a status. */
  live: boolean
}

const OPEN = (p: TrackerPo) => !p.isDispatched && p.state.key !== 'cancelled' && !p.isInternal
const base = (po: string) => po.match(/^\d{7}/)?.[0] ?? po

/**
 * efdashboard.com's order for a PO as a sheet writes it. The exact number
 * first, then a renamed one, then the same PO under another lot number,
 * preferring a lot still open over the latest dispatched.
 */
export function findPo(ref: string, tracker: Tracker): TrackerPo | null {
  const exact = tracker.byPo.get(ref)
  if (exact) return exact
  const renamed = tracker.pos.find((p) => p.formerPo === ref)
  if (renamed) return renamed
  const lots = tracker.pos.filter((p) => base(p.po) === base(ref) && p.state.key !== 'cancelled')
  return (
    lots.find(OPEN) ??
    [...lots].sort((a, b) => (b.dispatchDate ?? '').localeCompare(a.dispatchDate ?? '')).find((p) => p.isDispatched) ??
    null
  )
}

function quantitiesFor(po: TrackerPo, codes: string[]): Quantity[] {
  const hit = (label: string) => codes.some((c) => label.toLowerCase().includes(c.toLowerCase()))
  const mine = po.orderedQuantities.filter((q) => hit(q.label))
  return mine.length ? mine : po.orderedQuantities
}

/** The whole of time, for laying out runs that have no start or no end date. */
const ALL = { from: '1900-01-01', to: '9999-12-31' }

export function buildMachines(plan: MachinePlanT, tracker: Tracker | null): MachinesModel {
  const machines: Machine[] = plan.machines.map((m) => ({
    id: m.id,
    name: m.name,
    type: m.type,
    status: m.status,
    runs: m.runs.map((r) => ({
      product: r.product,
      family: familyOf(r.product),
      from: r.from,
      until: r.until,
      orders: r.orders.map((o): Order => {
        if ('po_required' in o) return { kind: 'required', count: o.po_required }
        if ('no_po' in o) return { kind: 'no-po', text: o.no_po }
        const po = tracker ? findPo(o.po, tracker) : null
        return { kind: 'po', ref: o.po, note: o.note ?? null, po, quantities: po ? quantitiesFor(po, r.codes ?? []) : [] }
      }),
      alongside: [],
      stopsAfter: r.stops_after ?? false,
      note: r.note ?? null,
    })),
    stops: m.stops,
    stopNote: m.stop_note,
    note: m.note,
  }))

  // A finishing run with no PO of its own works alongside the forming machines
  // making the same product at the same time.
  const forming = machines.filter((m) => m.type === 'forming').map((m) => ({ m, bars: timeline(m, ALL) }))
  for (const m of machines.filter((x) => x.type !== 'forming')) {
    for (const bar of timeline(m, ALL)) {
      if (bar.run.orders.length) continue
      bar.run.alongside = forming
        .filter(({ bars }) => bars.some((b) => productKey(b.product) === productKey(bar.product) && b.from <= bar.to && bar.from <= b.to))
        .map(({ m: f }) => ({ id: f.id, name: f.name }))
    }
  }

  // Months: from the month before the plan's date to the last date anything
  // runs until, so the month just finished is there to compare against.
  const ends = machines.flatMap((m) => [m.stops, ...m.runs.map((r) => r.until)]).filter((d): d is string => Boolean(d))
  const first = shiftMonth(plan.as_at.slice(0, 7), -1)
  const last = [plan.as_at.slice(0, 7), ...ends.map((d) => d.slice(0, 7))].sort().pop()!
  const months: string[] = []
  for (let m = first; m <= last; m = shiftMonth(m, 1)) months.push(m)

  const named = new Set(machines.flatMap((m) => m.runs.flatMap((r) => r.orders.map((o) => (o.kind === 'po' ? o.po?.po : null)))))
  const unplanned = tracker ? tracker.pos.filter(OPEN).filter((p) => !named.has(p.po)) : []

  const range = { from: `${months[0]}-01`, to: `${months.at(-1)}-${String(daysIn(months.at(-1)!)).padStart(2, '0')}` }
  return { asAt: plan.as_at, source: plan.source, machines, months, range, unplanned, live: tracker !== null }
}

/** A run is backed when the sheets name a PO for it, or it works alongside a machine that is. */
export const hasPo = (run: Run) => run.orders.some((o) => o.kind === 'po') || run.alongside.length > 0

export function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split('-').map(Number)
  const at = new Date(Date.UTC(y, m - 1 + by, 1))
  return at.toISOString().slice(0, 7)
}

export const daysIn = (month: string) => {
  const [y, m] = month.split('-').map(Number)
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

/** Days since 1 January 1970, for placing dates on a scale. */
export const dayNumber = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 86_400_000

export function addDays(iso: string, by: number): string {
  return new Date((dayNumber(iso) + by) * 86_400_000).toISOString().slice(0, 10)
}

/** One run as a bar on the Gantt chart: first and last running day, both inclusive. */
export type Bar = { product: string; family: Family; from: string; to: string; startsBefore: boolean; runsOn: boolean; run: Run }

/**
 * A machine's runs laid across a span. `until` is the change-over day, so a run
 * ends the day before, unless the machine stops that day or stands idle after it.
 */
export function timeline(machine: Machine, span: { from: string; to: string }): Bar[] {
  return machine.runs.flatMap((r) => {
    const last = r.until === null ? null : r.stopsAfter || r.until === machine.stops ? r.until : addDays(r.until, -1)
    const from = r.from !== null && r.from > span.from ? r.from : span.from
    const to = last === null || last > span.to ? span.to : last
    if (to < from) return []
    return [{
      product: r.product,
      family: r.family,
      from,
      to,
      startsBefore: r.from === null || r.from < span.from,
      runsOn: last === null || last > span.to,
      run: r,
    }]
  })
}

/** What a machine still has to run from a given day, the current run first. */
export function upcoming(machine: Machine, today: string): Bar[] {
  return timeline(machine, { from: today, to: ALL.to })
}

/** Stretches between two runs when the machine stands idle, within a span. */
export function gaps(machine: Machine, span: { from: string; to: string }): { from: string; to: string }[] {
  const all = timeline(machine, ALL)
  return all.slice(1).flatMap((next, i) => {
    const from = addDays(all[i].to, 1)
    const to = addDays(next.from, -1)
    const f = from < span.from ? span.from : from
    const t = to > span.to ? span.to : to
    return from <= to && f <= t ? [{ from: f, to: t }] : []
  })
}

/** From a given day on: each run, and each idle stretch between runs, in order. */
export type AgendaItem = { kind: 'run'; bar: Bar } | { kind: 'idle'; from: string; to: string }

export function agenda(machine: Machine, today: string): AgendaItem[] {
  const span = { from: today, to: ALL.to }
  const items: AgendaItem[] = [
    ...upcoming(machine, today).map((bar) => ({ kind: 'run' as const, bar })),
    ...gaps(machine, span).map((g) => ({ kind: 'idle' as const, ...g })),
  ]
  const start = (a: AgendaItem) => (a.kind === 'run' ? a.bar.from : a.from)
  return items.sort((a, b) => start(a).localeCompare(start(b)))
}

/** Where a machine stands on a given day. */
export type Now =
  | { state: 'running'; bar: Bar; next: Bar | null }
  | { state: 'maintenance'; bar: Bar | null }
  /** Its first run on the plan has not started yet. */
  | { state: 'starts'; bar: Bar }
  /** Between two runs. */
  | { state: 'idle'; bar: Bar }
  | { state: 'stopped'; on: string | null }
  | { state: 'no-plan' }

export function nowOf(machine: Machine, today: string): Now {
  if (machine.status === 'unscheduled' || machine.runs.length === 0) return { state: 'no-plan' }
  const [bar, next] = upcoming(machine, today)
  if (machine.status === 'maintenance') return { state: 'maintenance', bar: bar ?? null }
  if (!bar) return { state: 'stopped', on: machine.stops }
  if (bar.from <= today) return { state: 'running', bar, next: next ?? null }
  return timeline(machine, ALL).some((b) => b.to < today) ? { state: 'idle', bar } : { state: 'starts', bar }
}

/** A run's dates: `from` null when it was already running, `to` null when it has no end date. */
export type Span = { from: string | null; to: string | null }

/** Work planned or made without a PO, one row per product and what the sheets say. */
export type NoPoRow = {
  key: string
  product: string
  family: Family
  kind: 'required' | 'no-po' | 'none'
  text: string
  /** How many POs the sheets list as required. */
  count: number | null
  /** Machines running the same dates share an entry. */
  where: { machines: MachineRef[]; spans: Span[] }[]
}

/**
 * Every run the sheets list a PO as still required for, every run making work
 * with no PO, and every run from today on with no PO at all. A finishing run
 * alongside a forming machine is covered by that machine's row.
 */
export function withoutPo(machines: Machine[], today: string): NoPoRow[] {
  type Entry = { machine: MachineRef; spans: Span[] }
  const rows = new Map<string, NoPoRow & { byMachine: Map<string, Entry> }>()
  const add = (key: string, row: Omit<NoPoRow, 'key' | 'where'>, machine: Machine, span: Span) => {
    const r = rows.get(key) ?? { key, ...row, where: [], byMachine: new Map<string, Entry>() }
    if (row.count !== null) r.count = Math.max(r.count ?? 0, row.count)
    const entry = r.byMachine.get(machine.id) ?? { machine: { id: machine.id, name: machine.name }, spans: [] }
    if (!entry.spans.some((s) => s.from === span.from && s.to === span.to)) entry.spans.push(span)
    r.byMachine.set(machine.id, entry)
    rows.set(key, r)
  }

  for (const m of machines) {
    for (const bar of timeline(m, ALL)) {
      const r = bar.run
      const span: Span = { from: r.from === null ? null : bar.from, to: bar.runsOn ? null : bar.to }
      const product = productName(r.product)
      const pk = productKey(r.product)
      for (const o of r.orders) {
        if (o.kind === 'required') {
          add(`${pk}|required`, { product, family: r.family, kind: 'required', text: '', count: o.count }, m, span)
        } else if (o.kind === 'no-po') {
          add(`${pk}|no-po|${o.text}`, { product, family: r.family, kind: 'no-po', text: o.text, count: null }, m, span)
        }
      }
      if (!r.orders.length && !r.alongside.length && bar.to >= today) {
        add(`${pk}|none`, { product, family: r.family, kind: 'none', text: 'No PO on the plan', count: null }, m, span)
      }
    }
  }

  const order = { required: 0, 'no-po': 1, none: 2 }
  return [...rows.values()]
    .map(({ byMachine, ...row }) => {
      const where: NoPoRow['where'] = []
      for (const { machine, spans } of byMachine.values()) {
        const same = where.find((w) => JSON.stringify(w.spans) === JSON.stringify(spans))
        if (same) same.machines.push(machine)
        else where.push({ machines: [machine], spans })
      }
      const text = row.kind === 'required' ? (row.count === 1 ? 'PO required' : `${row.count} POs required`) : row.text
      return { ...row, text, where }
    })
    .sort((a, b) => order[a.kind] - order[b.kind])
}
