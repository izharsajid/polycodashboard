/**
 * Machine utilisation, month by month. No React.
 *
 * Every machine follows the production and finishing plans Izhar gave
 * (data/machine-plan.json): what each runs, from when, until when, and when it
 * stops. Each run is matched to open POs on efdashboard.com by the product codes
 * or PO numbers in the plan, and open orders no forming run covers are listed.
 */
import { z } from 'zod'
import type { Tracker, TrackerPo } from './tracker'

const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

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
      status: z.enum(['running', 'changing', 'stopped', 'offline', 'unscheduled']),
      runs: z.array(
        z.object({
          product: z.string(),
          from: IsoDate.nullable(),
          until: IsoDate.nullable(),
          match: z.array(z.string()),
          /** POs the plan names for this run; when given, only these are matched. */
          pos: z.array(z.string()).optional(),
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

/** An open PO a run serves, with the quantities that run makes for it. */
export type ServedPo = {
  po: TrackerPo
  quantities: { label: string; quantity: string }[]
}

export type Run = {
  product: string
  family: Family
  from: string | null
  until: string | null
  serves: ServedPo[]
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

/** One coloured stretch of a month's timeline. Days are 1-based and inclusive. */
export type Segment = { product: string; family: Family; fromDay: number; toDay: number; startsBefore: boolean; runsOn: boolean }

export type MachineMonth = {
  machine: Machine
  segments: Segment[]
  /** The day it stops, if that falls in this month. */
  stopDay: number | null
  /** Last days before it stands idle for a while, in this month. */
  pauseDays: number[]
  /** Running at any point in the month. */
  active: boolean
  runs: Run[]
}

const OPEN = (p: TrackerPo) => !p.isDispatched && p.state.key !== 'cancelled' && !p.isInternal

/** Open POs a run's product codes match, by product name or ordered item. */
export function serves(match: string[], tracker: Tracker | null, pos?: string[]): ServedPo[] {
  if (!tracker || (match.length === 0 && !pos?.length)) return []
  const hit = (text: string) => match.some((m) => text.toLowerCase().includes(m.toLowerCase()))
  return tracker.pos
    .filter(OPEN)
    .filter((p) => (pos?.length ? pos.includes(p.po) : hit(p.product) || p.orderedQuantities.some((q) => hit(q.label))))
    .map((p) => {
      const items = p.orderedQuantities.filter((q) => hit(q.label))
      return { po: p, quantities: items.length ? items : p.orderedQuantities }
    })
}

export type MachinesModel = {
  asAt: string
  source: string
  machines: Machine[]
  months: string[]
  /** The whole span the months cover, first day to last, for the Gantt chart. */
  range: { from: string; to: string }
  /** Open POs on efdashboard.com no planned forming run serves. */
  unplanned: TrackerPo[]
}

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
      serves: serves(r.match, tracker, r.pos),
      stopsAfter: r.stops_after ?? false,
      note: r.note ?? null,
    })),
    stops: m.stops,
    stopNote: m.stop_note,
    note: m.note,
  }))
  // Months: from the month before the plan's date to the last date anything
  // runs until, so the month just finished is there to compare against.
  const ends = machines.flatMap((m) => [m.stops, ...m.runs.map((r) => r.until)]).filter((d): d is string => Boolean(d))
  const first = shiftMonth(plan.as_at.slice(0, 7), -1)
  const last = [plan.as_at.slice(0, 7), ...ends.map((d) => d.slice(0, 7))].sort().pop()!
  const months: string[] = []
  for (let m = first; m <= last; m = shiftMonth(m, 1)) months.push(m)

  // Every open order a forming run will make, at the plan date or later.
  const covered = new Set(
    machines.filter((m) => m.type === 'forming').flatMap((m) => m.runs.filter((r) => r.until === null || r.until >= plan.as_at).flatMap((r) => r.serves.map((s) => s.po.po))),
  )
  const unplanned = tracker ? tracker.pos.filter(OPEN).filter((p) => !covered.has(p.po)) : []

  const range = { from: `${months[0]}-01`, to: `${months.at(-1)}-${String(daysIn(months.at(-1)!)).padStart(2, '0')}` }
  return { asAt: plan.as_at, source: plan.source, machines, months, range, unplanned }
}

export function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split('-').map(Number)
  const at = new Date(Date.UTC(y, m - 1 + by, 1))
  return at.toISOString().slice(0, 7)
}

export const daysIn = (month: string) => {
  const [y, m] = month.split('-').map(Number)
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

/** What a machine does across one month: coloured stretches and its stop day. */
export function machineMonth(machine: Machine, month: string): MachineMonth {
  const n = daysIn(month)
  const start = `${month}-01`
  const end = `${month}-${String(n).padStart(2, '0')}`
  const dayOf = (d: string) => Number(d.slice(8, 10))
  const segments: Segment[] = []
  const runs: Run[] = []
  for (const r of machine.runs) {
    const from = r.from && r.from > start ? r.from : start
    // `until` is the change-over day: the run ends the day before, unless the
    // machine stops that day.
    const lastDay = r.until === null ? end : r.until <= end ? r.until : end
    if (from > end || (r.until !== null && r.until < start)) continue
    const stopHere = machine.stops !== null && machine.stops >= start && machine.stops <= end
    let toDay = dayOf(lastDay)
    if (r.until !== null && r.until <= end && !r.stopsAfter && !(stopHere && machine.stops === r.until)) toDay -= 1
    const fromDay = dayOf(from)
    if (toDay < fromDay) continue
    segments.push({ product: r.product, family: r.family, fromDay, toDay, startsBefore: r.from === null || r.from < start, runsOn: r.until === null || r.until > end })
    runs.push(r)
  }
  const stopDay = machine.stops && machine.stops.startsWith(month) ? dayOf(machine.stops) : null
  const pauseDays = runs.filter((r) => r.stopsAfter && r.until?.startsWith(month)).map((r) => dayOf(r.until!))
  return { machine, segments, stopDay, pauseDays, active: segments.length > 0, runs }
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
  return timeline(machine, { from: today, to: '9999-12-31' })
}
