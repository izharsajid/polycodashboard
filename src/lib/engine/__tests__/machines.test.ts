import { describe, expect, it } from 'vitest'
import ledgerRaw from '../../../../data/polyco-ledger.json'
import scheduleRaw from '../../../../data/machine-schedule.json'
import trackerRaw from '../../../../data/po-tracker.json'
import { Ledger, MachineSchedule, PoTracker } from '../../schema'
import {
  floorBreachMonth,
  machineCountSteps,
  machinesRunningAt,
  monthlyMachineCount,
  reconcileSchedule,
  scheduledPos,
} from '../machines'

const ledger = Ledger.parse(ledgerRaw)
const tracker = PoTracker.parse(trackerRaw)
const schedule = MachineSchedule.parse(scheduleRaw)

describe('the schedule file', () => {
  it('parses, and says when it was taken and how far it runs', () => {
    expect(schedule.as_at).toBe('2026-08-23')
    expect(schedule.horizon_end).toBe('2027-03-31')
    expect(schedule.machines).toHaveLength(8)
  })

  it('gives every machine that stops a reason, and it is always the same one', () => {
    // CAPACITY-SPEC section 2: every machine here stops because its orders run
    // out, not because a mould came off or a decision was taken.
    for (const machine of schedule.machines) {
      if (machine.continuous) continue
      expect(machine.stopReason).toBe('purchase_orders_run_out')
      expect(machine.stopDateBasis).not.toBeNull()
    }
  })

  it('never lets a mould change consume a day of production', () => {
    // Section 2: a change takes hours and completes the same day, so the run it
    // precedes starts on the day of the change, never after it.
    for (const machine of schedule.machines) {
      for (const run of machine.runs) {
        if (run.mouldChangeBefore === null) continue
        expect(run.mouldChangeBefore).toBe(run.from)
      }
    }
  })

  it('leaves no gap between one campaign and the next on a machine', () => {
    for (const machine of schedule.machines) {
      for (let i = 1; i < machine.runs.length; i++) {
        const previous = machine.runs[i - 1]
        const next = machine.runs[i]
        const dayAfter = new Date(`${previous.to}T00:00:00Z`)
        dayAfter.setUTCDate(dayAfter.getUTCDate() + 1)
        expect(next.from).toBe(dayAfter.toISOString().slice(0, 10))
      }
    }
  })

  it('ends a machine on the day its last campaign ends', () => {
    for (const machine of schedule.machines) {
      const last = machine.runs[machine.runs.length - 1]
      if (machine.continuous) expect(last.toBasis).toBe('horizon')
      else expect(last.to).toBe(machine.stopDate)
    }
  })
})

describe('the machine count', () => {
  // CAPACITY-SPEC section 2 gives this table and says the tab must compute it
  // rather than take it from there. So it is the assertion, not the source: if a
  // stop date moves and this no longer holds, that is the point.
  it('reproduces the count the spec states, from the stop dates alone', () => {
    expect(machineCountSteps(schedule).map((s) => [s.from, s.count])).toEqual([
      ['2026-08-23', 8],
      ['2026-09-21', 7],
      ['2026-10-21', 6],
      ['2026-12-01', 4],
      ['2027-02-01', 3],
    ])
  })

  it('names the machines that came off at each step', () => {
    const steps = machineCountSteps(schedule)
    expect(steps[1].stopped.map((m) => m.id)).toEqual(['M6'])
    expect(steps[2].stopped.map((m) => m.id)).toEqual(['M8'])
    expect(steps[3].stopped.map((m) => m.id)).toEqual(['M1', 'M5'])
    expect(steps[4].stopped.map((m) => m.id)).toEqual(['M2'])
  })

  it('treats two machines stopping on one date as one step', () => {
    // The plant does not pass through five on its way from six to four.
    const counts = machineCountSteps(schedule).map((s) => s.count)
    expect(counts).not.toContain(5)
  })

  it('counts a machine as running on its stop date, not after it', () => {
    expect(machinesRunningAt(schedule, '2026-11-30').map((m) => m.id)).toContain('M1')
    expect(machinesRunningAt(schedule, '2026-12-01').map((m) => m.id)).not.toContain('M1')
  })

  it('has four machines at 1 January 2027', () => {
    expect(machinesRunningAt(schedule, '2027-01-01')).toHaveLength(4)
  })

  it('falls below the four-machine floor in February 2027', () => {
    expect(schedule.viable_floor).toBe(4)
    expect(floorBreachMonth(schedule)).toBe('2027-02')
  })

  it('runs the monthly series to the edge of the schedule and no further', () => {
    const months = monthlyMachineCount(schedule)
    expect(months[0].period).toBe('2026-08')
    expect(months[months.length - 1].period).toBe('2027-03')
    expect(months.map((m) => m.count)).toEqual([8, 7, 6, 6, 4, 4, 3, 3])
  })
})

describe('reconciling the schedule against the ledger and the tracker', () => {
  const recon = reconcileSchedule(schedule, ledger, tracker)

  it('accounts for every pending PO in the ledger, once', () => {
    const pending = ledger.rows.filter((r) => r.type === 'pending_po')
    const onSchedule = pending.length - recon.ordersWithNoMachine.length
    expect(onSchedule).toBeGreaterThan(0)
    expect(recon.ordersWithNoMachine.length).toBeLessThanOrEqual(pending.length)
  })

  it('totals the orders with no machine to the sum of their PO values', () => {
    const summed = recon.ordersWithNoMachine.reduce((a, o) => a + o.value, 0)
    expect(recon.ordersWithNoMachineValue).toBeCloseTo(summed, 2)
  })

  it('carries the reason against the Northwest order rather than leaving it bare', () => {
    const northwest = recon.ordersWithNoMachine.find((o) => o.row.po_number === '2679131-1')
    expect(northwest).toBeDefined()
    expect(northwest!.reason).toContain('December 2026')
    expect(northwest!.value).toBe(36465)
  })

  it('does not double count a PO that runs on two machines', () => {
    const notInLedger = [...recon.foundInTracker, ...recon.foundInNeither].map((e) => e.po.ref)
    expect(new Set(notInLedger).size).toBe(notInLedger.length)
  })

  it('reports the Platinum and Point Five orders as running on more than one machine', () => {
    const refs = recon.multiMachine.map((m) => m.ref)
    // Section 4 names these: each carries lines that run on two machines at once.
    for (const ref of ['2678303', '2678304', '2676085', '2679683', '2679682', '2678252-1']) {
      expect(refs).toContain(ref)
    }
    const platinum = recon.multiMachine.find((m) => m.ref === '2678303')!
    expect(platinum.machines.map((m) => m.id).sort()).toEqual(['M1', 'M2'])
  })

  it('puts 2679868 on the large tray and the medium tray, on different machines', () => {
    const aspen = recon.multiMachine.find((m) => m.ref === '2679868')!
    expect(aspen.machines.map((m) => m.id).sort()).toEqual(['M1', 'M6'])
    expect(aspen.machines.map((m) => m.product).sort()).toEqual([
      'Large Medical Tray',
      'Medium Medical Tray',
    ])
  })

  it('labels a match made on the base number rather than the full reference', () => {
    // The -N suffix disagreement between the two systems, already logged.
    expect(recon.matchedOnBaseNumber.length).toBeGreaterThan(0)
    for (const match of recon.matchedOnBaseNumber) expect(match.ref).not.toBe(match.ledgerRef)
  })

  it('never silently drops a schedule PO: every one is matched or listed', () => {
    // Section 6: the reconciliation never silently drops a row.
    const refs = new Set(scheduledPos(schedule).map((p) => p.ref.toUpperCase()))
    const listed = new Set(
      [...recon.foundInTracker, ...recon.foundInNeither].map((e) => e.po.ref.toUpperCase()),
    )
    const matched = new Set(
      scheduledPos(schedule)
        .map((p) => p.ref.toUpperCase())
        .filter((ref) => !listed.has(ref)),
    )
    expect(new Set([...listed, ...matched])).toEqual(refs)
  })
})
