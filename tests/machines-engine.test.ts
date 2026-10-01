/**
 * Machine utilisation against the plans of 1 October 2026 and the efdashboard.com
 * PO snapshot of 30 September.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildMachines, familyOf, machineMonth, MachinePlan, timeline, upcoming } from '../src/engine/machines'
import { buildTracker } from '../src/engine/tracker'
import { TrackerPayload } from '../src/engine/trackerSchema'

const read = (p: string) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'))
const payload = TrackerPayload.parse(read('./fixtures/tracker-2026-09-30.json'))
const model = buildMachines(MachinePlan.parse(read('../data/machine-plan.json')), buildTracker(payload))
const machine = (name: string) => model.machines.find((m) => m.name === name)!
const pos = (name: string) => [...new Set(machine(name).runs.flatMap((r) => r.serves.map((s) => s.po.po)))].sort()

describe('the months', () => {
  it('run from September, the month before the plan, to the last stop in December', () => {
    expect(model.months).toEqual(['2026-09', '2026-10', '2026-11', '2026-12'])
  })
})

describe('what each machine runs', () => {
  it('changes Machine 1 from Platinum C3 to the 1/2M lid on 10 October', () => {
    const oct = machineMonth(machine('Machine 1'), '2026-10')
    expect(oct.segments.map((s) => [s.product, s.fromDay, s.toDay])).toEqual([
      ['Platinum C3', 1, 9],
      ['1/2M Lid', 10, 31],
    ])
  })

  it('stops Machine 6 on 25 October and leaves it idle in November', () => {
    expect(machineMonth(machine('Machine 6'), '2026-10').stopDay).toBe(25)
    expect(machineMonth(machine('Machine 6'), '2026-11').active).toBe(false)
  })

  it('keeps Machine 4 running with no end date', () => {
    expect(machineMonth(machine('Machine 4'), '2026-12').segments[0].runsOn).toBe(true)
  })

  it('takes every machine from the plans, and nothing else', () => {
    expect(model.machines).toHaveLength(15)
    expect(model.machines.filter((m) => m.type === 'xray')).toEqual([])
    expect(machine('Manual Trimmer 2').type).toBe('trimming')
  })

  it('lists the two auto trimmers with no runs until a plan is given', () => {
    for (const name of ['Auto Trimmer 1', 'Auto Trimmer 2']) {
      expect(machine(name).status).toBe('unscheduled')
      expect(timeline(machine(name), model.range)).toEqual([])
    }
  })

  it('runs Lamination Machine 1 on Platinum 2, 3, then 2, and stops it after 25 October', () => {
    const oct = machineMonth(machine('Lamination Machine 1'), '2026-10')
    expect(oct.segments.map((s) => [s.product, s.fromDay, s.toDay])).toEqual([
      ['Platinum 2', 1, 9],
      ['Platinum 3', 10, 16],
      ['Platinum 2', 17, 25],
    ])
    expect(oct.pauseDays).toEqual([25])
    expect(machineMonth(machine('Lamination Machine 1'), '2026-11').segments.map((s) => [s.product, s.fromDay, s.toDay])).toEqual([
      ['Platinum 1', 20, 30],
    ])
    expect(machineMonth(machine('Lamination Machine 1'), '2026-12').stopDay).toBe(20)
  })

  it('alternates Lamination Machine 2 between the Potato tray and the 1/2M bowl', () => {
    const nov = machineMonth(machine('Lamination Machine 2'), '2026-11')
    expect(nov.segments.map((s) => [s.product, s.fromDay, s.toDay])).toEqual([
      ['1/2M Bowl', 1, 4],
      ['Potato Tray', 5, 19],
      ['1/2M Bowl', 20, 30],
    ])
    expect(familyOf('Potato Tray')).toBe('destiny')
    expect(familyOf('Every Table')).toBe('pointfive')
    expect(familyOf('1/2M Bowl')).toBe('halfm')
  })

  it('switches Manual Trimmer 2 from the medium medical tray to Oasis on 25 October', () => {
    const oct = machineMonth(machine('Manual Trimmer 2'), '2026-10')
    expect(oct.segments.map((s) => [s.product, s.fromDay, s.toDay])).toEqual([
      ['Medium Medical Tray', 1, 24],
      ['Oasis Tray', 25, 31],
    ])
  })
})

describe('matching machines to open POs', () => {
  it('ties a finishing run to the PO the sheet names', () => {
    expect(pos('Lamination Machine 1')).toEqual(['2679969', '2679971'])
    const lam2 = machine('Lamination Machine 2')
    expect(lam2.runs[0].serves.map((s) => s.po.po)).toEqual(['2466123-3'])
    expect(lam2.runs[1].serves).toEqual([])
    expect(lam2.runs[2].serves).toEqual([])
    expect(lam2.runs[2].note).toBe('1/2M PO required')
  })

  it('ties each forming run to the open POs for its product', () => {
    expect(pos('Machine 6')).toEqual(['2679868', '2680265-1'])
    expect(pos('Machine 3')).toEqual(['2679867', '2680266-1'])
    expect(pos('Machine 5')).toEqual([])
  })

  it('shows only the quantity that run makes for a PO with several products', () => {
    const run = machine('Machine 6').runs[0]
    const served = run.serves.find((s) => s.po.po === '2679868')!
    expect(served.quantities.map((q) => q.label)).toEqual(['Aspen Single Cycle Tray Medium (PHTRASCM)'])
  })

  it('lists open orders no forming run is planned for', () => {
    expect(model.unplanned.map((p) => p.po)).toEqual(expect.arrayContaining(['2466123-3', '2573712']))
    expect(model.unplanned.map((p) => p.po)).not.toContain('2679868')
  })

  it('groups products into families for colour', () => {
    expect(familyOf('PHTRASCM')).toBe('medical')
    expect(familyOf('Platinum C2')).toBe('platinum')
    expect(familyOf('1/2M Bowl')).toBe('halfm')
  })
})

describe('the Gantt timeline', () => {
  const bars = (name: string) => timeline(machine(name), model.range).map((b) => [b.product, b.from, b.to])

  it('spans September to the end of December', () => {
    expect(model.range).toEqual({ from: '2026-09-01', to: '2026-12-31' })
  })

  it('lays each run end to end, the last running through its stop day', () => {
    expect(bars('Machine 1')).toEqual([
      ['Large Medical Tray', '2026-09-01', '2026-09-28'],
      ['Platinum C3', '2026-09-29', '2026-10-09'],
      ['1/2M Lid', '2026-10-10', '2026-12-30'],
    ])
  })

  it('leaves the gap where Lamination Machine 1 stands idle', () => {
    expect(bars('Lamination Machine 1').slice(2, 4)).toEqual([
      ['Platinum 2', '2026-10-17', '2026-10-25'],
      ['Platinum 1', '2026-11-20', '2026-12-07'],
    ])
  })

  it('runs a machine with no end date to the edge, marked as running on', () => {
    const [bar] = timeline(machine('Machine 4'), model.range)
    expect([bar.to, bar.startsBefore, bar.runsOn]).toEqual(['2026-12-31', true, true])
  })

  it('lists what is still to run from a given day', () => {
    expect(upcoming(machine('Machine 1'), '2026-10-12').map((b) => b.product)).toEqual(['1/2M Lid'])
    expect(upcoming(machine('Machine 8'), '2026-10-21')).toEqual([])
  })
})
