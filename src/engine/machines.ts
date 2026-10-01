/**
 * Machine utilisation, month by month. No React.
 *
 * Forming, lamination and the manual trimmers follow the production and
 * finishing plans (data/machine-plan.json): what each runs, from when, until
 * when, and when it stops. Machines the plan does not list, the auto trimmers
 * and the X-ray, follow efdashboard.com's Line Usage live, with no end dates. Each
 * run is matched to open POs on efdashboard.com by the product codes in the
 * plan, and open orders no run covers are listed.
 */
import { z } from 'zod'
import type { Tracker, TrackerPo } from './tracker'
import type { LineUsageRowT } from './trackerSchema'

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
      status: z.enum(['running', 'changing', 'stopped', 'offline']),
      /** The same machine's name in efdashboard.com's Line Usage, where it differs. */
      line_usage: z.string().optional(),
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
  /** Where the machine's picture comes from: the plan, or efdashboard.com live. */
  source: 'plan' | 'efdashboard.com'
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

const TYPE_OF_SECTION: Record<string, MachineType> = { thermoforming: 'forming', lamination: 'lamination', xray: 'xray' }

/** A Line Usage machine, as a machine with one open-ended run. */
function fromLineUsage(r: LineUsageRowT, tracker: Tracker | null): Machine {
  const type: MachineType = /trim/i.test(r.machine) ? 'trimming' : TYPE_OF_SECTION[r.section] ?? 'lamination'
  const product = r.product.trim()
  return {
    id: `line-${r.id}`,
    name: r.machine,
    type,
    status: r.running ? 'running' : 'offline',
    source: 'efdashboard.com',
    runs:
      r.running && product
        ? [{ product, family: familyOf(product), from: null, until: null, serves: serves(codesFor(product), tracker), stopsAfter: false, note: null }]
        : [],
    stops: null,
    stopNote: null,
    note: [r.running ? (r.schedule ? `Running ${r.schedule}` : 'Running') : 'Offline', r.notes].filter(Boolean).join('. ') || null,
  }
}

/**
 * The words efdashboard.com's orders use for each family, for Line Usage
 * products that name only an internal code (TFTRA7X7 is the Destiny 7x7 tray).
 * Platinum and medical trays are matched by their exact tray code instead,
 * because one family covers several different trays.
 */
const FAMILY_WORDS: Partial<Record<Family, string[]>> = {
  oasis: ['OT1230', 'Oasis'],
  pointfive: ['Point Five', 'PointFive'],
  destiny: ['7x7', 'Destiny'],
}

/** Product codes to match a Line Usage product by, taken from its own text. */
function codesFor(product: string): string[] {
  const code = product.match(/\(([^)]+)\)/)?.[1]
  const out = [product, ...(FAMILY_WORDS[familyOf(product)] ?? [])]
  if (code) out.push(code)
  const tray = product.match(/TFPP\/TRAY\s?(\d)/i)
  if (tray) out.push(`TFPP/TRAY${tray[1]}`)
  return out
}

export type MachinesModel = {
  asAt: string
  source: string
  machines: Machine[]
  months: string[]
  /** The whole span the months cover, first day to last, for the Gantt chart. */
  range: { from: string; to: string }
  /** Open POs on efdashboard.com no planned run serves. */
  unplanned: TrackerPo[]
  /** Where efdashboard.com's Line Usage disagrees with the plan for a forming machine. */
  differences: { machine: string; plan: string; lineUsage: string }[]
}

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

const runningOn = (run: { from: string | null; until: string | null }, d: string) =>
  (run.from === null || run.from <= d) && (run.until === null || d < run.until)

export function buildMachines(plan: MachinePlanT, tracker: Tracker | null, lineUsage: LineUsageRowT[]): MachinesModel {
  const planned: Machine[] = plan.machines.map((m) => ({
    id: m.id,
    name: m.name,
    type: m.type,
    status: m.status,
    source: 'plan',
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
  // Line Usage rows for machines the plan lists are compared, not shown twice.
  const luName = new Map(plan.machines.map((m) => [m.id, m.line_usage ?? m.name]))
  const claimed = [...luName.values()]
  const planForms = planned.some((m) => m.type === 'forming')
  const live = lineUsage.filter(
    (r) => !claimed.some((n) => sameName(n, r.machine)) && !(planForms && r.section === 'thermoforming'),
  )
  const machines = [...planned, ...live.map((r) => fromLineUsage(r, tracker))]

  // Months: from the month before the plan's date to the last date anything
  // runs until, so the month just finished is there to compare against.
  const ends = machines.flatMap((m) => [m.stops, ...m.runs.map((r) => r.until)]).filter((d): d is string => Boolean(d))
  const first = shiftMonth(plan.as_at.slice(0, 7), -1)
  const last = [plan.as_at.slice(0, 7), ...ends.map((d) => d.slice(0, 7))].sort().pop()!
  const months: string[] = []
  for (let m = first; m <= last; m = shiftMonth(m, 1)) months.push(m)

  // Every open order a forming run will make, at the plan date or later.
  const covered = new Set(
    planned.filter((m) => m.type === 'forming').flatMap((m) => m.runs.filter((r) => r.until === null || r.until >= plan.as_at).flatMap((r) => r.serves.map((s) => s.po.po))),
  )
  const unplanned = tracker ? tracker.pos.filter(OPEN).filter((p) => !covered.has(p.po)) : []

  const differences = planned.flatMap((m) => {
    const lu = lineUsage.find((r) => sameName(r.machine, luName.get(m.id)!))
    if (!lu) return []
    const now = m.runs.find((r) => runningOn(r, plan.as_at))
    const planText = m.status === 'changing' ? `Mould changing, ${now?.product ?? 'no product'}` : now ? now.product : 'Stopped'
    const luText =
      (sameName(lu.machine, m.name) ? '' : `${lu.machine}: `) +
      (lu.running ? lu.product || 'Running' : `Offline${lu.notes ? ` (${lu.notes})` : ''}`)
    const agree = lu.running && now && familyOf(lu.product) === now.family && familyOf(lu.product) !== 'other'
    return agree ? [] : [{ machine: m.name, plan: planText, lineUsage: luText }]
  })

  const range = { from: `${months[0]}-01`, to: `${months.at(-1)}-${String(daysIn(months.at(-1)!)).padStart(2, '0')}` }
  return { asAt: plan.as_at, source: plan.source, machines, months, range, unplanned, differences }
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
