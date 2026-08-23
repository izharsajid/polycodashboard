import type {
  LedgerRowT,
  LedgerT,
  MachineScheduleT,
  MachineT,
  PoOrderT,
  PoTrackerT,
} from '../schema'
import { round2 } from './index'

/**
 * The machine schedule: what runs, when it stops, and what that leaves.
 *
 * CAPACITY-SPEC section 2 is explicit that the machine count is computed here
 * rather than copied from the table in the spec, so that a change to one stop
 * date moves every figure on the tab. The table in the spec is the test, not the
 * source: `machines.test.ts` asserts this function reproduces it.
 */
const normalise = (value: string | null | undefined) => String(value ?? '').trim().toUpperCase()

/** `2465639-2` to `2465639`. The suffix is the line or shipment, not the order. */
const baseNumber = (value: string) => normalise(value).replace(/-\d+$/, '')

export type MatchKind = 'exact' | 'base'

const addDays = (iso: string, count: number): string => {
  const at = new Date(`${iso}T00:00:00Z`)
  at.setUTCDate(at.getUTCDate() + count)
  return at.toISOString().slice(0, 10)
}

const endOfMonth = (period: string): string => {
  const [year, month] = period.split('-').map(Number)
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10)
}

const addMonths = (period: string, count: number): string => {
  const [year, month] = period.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1 + count, 1)).toISOString().slice(0, 7)
}

/**
 * Is this machine still running on this date?
 *
 * A continuous machine has no stop date and runs to the edge of the schedule. A
 * machine that stops is running up to and including its stop date, which is why
 * the count falls on the day after: the spec's own table reads "1 Dec 2026, 4",
 * for machines whose last day is 30 November.
 */
export function runningAt(machine: MachineT, date: string): boolean {
  if (machine.continuous || machine.stopDate === null) return true
  return date <= machine.stopDate
}

export function machinesRunningAt(schedule: MachineScheduleT, date: string): MachineT[] {
  return schedule.machines.filter((machine) => runningAt(machine, date))
}

export type CountStep = {
  /** The first date this count applies from. */
  from: string
  count: number
  /** Which machines came off to produce it, empty on the opening row. */
  stopped: MachineT[]
}

/**
 * The machine count as a series of steps, one per date the count changes.
 *
 * Two machines stopping on the same date is one step, not two, because the plant
 * does not pass through seven on its way from eight to six.
 */
export function machineCountSteps(schedule: MachineScheduleT): CountStep[] {
  const stopDates = [
    ...new Set(
      schedule.machines
        .map((machine) => machine.stopDate)
        .filter((date): date is string => date !== null),
    ),
  ].sort()

  const steps: CountStep[] = [
    { from: schedule.as_at, count: machinesRunningAt(schedule, schedule.as_at).length, stopped: [] },
  ]

  for (const stopDate of stopDates) {
    const from = addDays(stopDate, 1)
    steps.push({
      from,
      count: machinesRunningAt(schedule, from).length,
      stopped: schedule.machines.filter((machine) => machine.stopDate === stopDate),
    })
  }
  return steps
}

export type MonthCount = {
  /** `2026-09` */
  period: string
  /** Machines still running on the last day of the month. */
  count: number
  /** True where the count sits below the stated viable floor. */
  belowFloor: boolean
}

/**
 * Machines running by month, to the edge of the schedule.
 *
 * Counted on the last day of each month. A machine that stops on the 30th ran
 * that month, and showing it as gone would credit the plant with a month it did
 * not have.
 */
export function monthlyMachineCount(schedule: MachineScheduleT): MonthCount[] {
  const out: MonthCount[] = []
  const last = schedule.horizon_end.slice(0, 7)

  for (let period = schedule.as_at.slice(0, 7); period <= last; period = addMonths(period, 1)) {
    const count = machinesRunningAt(schedule, endOfMonth(period)).length
    out.push({ period, count, belowFloor: count < schedule.viable_floor })
  }
  return out
}

/** The first month the count sits below the floor, or null if it never does. */
export function floorBreachMonth(schedule: MachineScheduleT): string | null {
  return monthlyMachineCount(schedule).find((month) => month.belowFloor)?.period ?? null
}

export type ScheduledPo = {
  ref: string
  basis: 'confirmed' | 'derived'
  note: string | null
  machineId: string
  machineName: string
  product: string
}

/** Every purchase order on the schedule, one row per machine it runs on. */
export function scheduledPos(schedule: MachineScheduleT): ScheduledPo[] {
  return schedule.machines.flatMap((machine) =>
    machine.runs.flatMap((run) =>
      run.purchaseOrders.map((po) => ({
        ref: po.ref,
        basis: po.basis,
        note: po.note,
        machineId: machine.id,
        machineName: machine.name,
        product: run.product,
      })),
    ),
  )
}

export type OrderWithNoMachine = {
  row: LedgerRowT
  value: number
  /** Why it is not on a machine, where that is known. Section 4. */
  reason: string | null
}

export type ScheduleOrderNotInLedger = {
  po: ScheduledPo
  /** The tracker row that explains it, where there is one. */
  trackerOrder: PoOrderT | null
}

export type MultiMachineOrder = {
  ref: string
  machines: { id: string; name: string; product: string }[]
}

export type ScheduleReconciliation = {
  /**
   * Pending POs in the ledger on no machine. Shown with its total, and not raised
   * as an alarm: section 4 records that these are being worked through separately.
   */
  ordersWithNoMachine: OrderWithNoMachine[]
  ordersWithNoMachineValue: number
  /** Schedule POs the ledger does not carry, split by whether the tracker explains them. */
  foundInTracker: ScheduleOrderNotInLedger[]
  foundInNeither: ScheduleOrderNotInLedger[]
  /** Expected, not an error. One PO can carry several SKUs. Section 4. */
  multiMachine: MultiMachineOrder[]
  /** How each ledger match was made, so the page can say which rather than imply. */
  matchedOnBaseNumber: { ref: string; ledgerRef: string }[]
}

type Index<T> = { exact: Map<string, T>; base: Map<string, T[]> }

function indexBy<T>(items: T[], key: (item: T) => string): Index<T> {
  const exact = new Map<string, T>()
  const base = new Map<string, T[]>()
  for (const item of items) {
    const ref = normalise(key(item))
    if (!ref) continue
    if (!exact.has(ref)) exact.set(ref, item)
    const b = baseNumber(ref)
    base.set(b, [...(base.get(b) ?? []), item])
  }
  return { exact, base }
}

/**
 * Look the reference up on the full reference first, then on the base number,
 * and say which. Section 4. A base match is reported rather than merged silently
 * because the two systems disagree about how a reference is written, and that
 * disagreement is itself worth seeing.
 */
function lookup<T>(index: Index<T>, ref: string): { hit: T; how: MatchKind } | null {
  const wanted = normalise(ref)
  const exact = index.exact.get(wanted)
  if (exact !== undefined) return { hit: exact, how: 'exact' }

  const candidates = index.base.get(baseNumber(wanted)) ?? []
  // Exactly one candidate, or it is a guess about which line was meant.
  return candidates.length === 1 ? { hit: candidates[0], how: 'base' } : null
}

export function reconcileSchedule(
  schedule: MachineScheduleT,
  ledger: LedgerT,
  tracker: PoTrackerT,
): ScheduleReconciliation {
  const onSchedule = scheduledPos(schedule)
  const scheduleIndex = indexBy(onSchedule, (po) => po.ref)
  const trackerIndex = indexBy(tracker.orders, (order) => order.po_number)
  const pending = ledger.rows.filter((row) => row.type === 'pending_po')
  const ledgerIndex = indexBy(ledger.rows, (row) => row.po_number ?? '')

  const reasons = new Map(
    schedule.unscheduled_reasons.map((entry) => [normalise(entry.ref), entry.reason]),
  )

  const ordersWithNoMachine: OrderWithNoMachine[] = pending
    .filter((row) => lookup(scheduleIndex, row.po_number ?? '') === null)
    .map((row) => ({
      row,
      value: row.po_amount ?? 0,
      reason: reasons.get(normalise(row.po_number)) ?? null,
    }))

  const matchedOnBaseNumber: { ref: string; ledgerRef: string }[] = []
  const notInLedger: ScheduleOrderNotInLedger[] = []

  // One row per distinct reference: a PO on two machines is not two gaps.
  const seen = new Set<string>()
  for (const po of onSchedule) {
    const ref = normalise(po.ref)
    if (seen.has(ref)) continue
    seen.add(ref)

    const inLedger = lookup(ledgerIndex, po.ref)
    if (inLedger) {
      if (inLedger.how === 'base') {
        matchedOnBaseNumber.push({ ref: po.ref, ledgerRef: inLedger.hit.po_number ?? '' })
      }
      continue
    }
    notInLedger.push({ po, trackerOrder: lookup(trackerIndex, po.ref)?.hit ?? null })
  }

  const byRef = new Map<string, MultiMachineOrder>()
  for (const po of onSchedule) {
    const ref = normalise(po.ref)
    const hit = byRef.get(ref) ?? { ref: po.ref, machines: [] }
    hit.machines.push({ id: po.machineId, name: po.machineName, product: po.product })
    byRef.set(ref, hit)
  }

  return {
    ordersWithNoMachine,
    ordersWithNoMachineValue: round2(
      ordersWithNoMachine.reduce((total, order) => total + order.value, 0),
    ),
    foundInTracker: notInLedger.filter((entry) => entry.trackerOrder !== null),
    foundInNeither: notInLedger.filter((entry) => entry.trackerOrder === null),
    multiMachine: [...byRef.values()]
      .filter((entry) => entry.machines.length > 1)
      .sort((a, b) => a.ref.localeCompare(b.ref)),
    matchedOnBaseNumber,
  }
}
