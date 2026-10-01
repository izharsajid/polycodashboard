/**
 * Machine utilisation against the plan of 1 October 2026 and the efdashboard.com
 * snapshot of 30 September.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildMachines, familyOf, machineMonth, MachinePlan } from '../src/engine/machines'
import { buildTracker } from '../src/engine/tracker'
import { TrackerPayload } from '../src/engine/trackerSchema'

const read = (p: string) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'))
const payload = TrackerPayload.parse(read('./fixtures/tracker-2026-09-30.json'))
const model = buildMachines(MachinePlan.parse(read('../data/machine-plan.json')), buildTracker(payload), payload.line_usage)
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

  it('reads lamination and trimming live from efdashboard.com', () => {
    expect(machine('Laminator 1').status).toBe('offline')
    expect(machine('Laminator 1').note).toContain('CPET Film Out of Stock')
    expect(machine('Auto Trimmer 1').type).toBe('trimming')
    expect(machine('Auto Trimmer 1').source).toBe('efdashboard.com')
  })
})

describe('matching machines to open POs', () => {
  it('ties each forming run to the open POs for its product', () => {
    expect(pos('Machine 6')).toEqual(['2679868', '2680265-1'])
    expect(pos('Machine 3')).toEqual(['2679867', '2680266-1'])
    expect(pos('Machine 5')).toEqual(['2679682'])
  })

  it('shows only the quantity that run makes for a PO with several products', () => {
    const run = machine('Machine 6').runs[0]
    const served = run.serves.find((s) => s.po.po === '2679868')!
    expect(served.quantities.map((q) => q.label)).toEqual(['Aspen Single Cycle Tray Medium (PHTRASCM)'])
  })

  it('matches a trimmer on an internal code to the order it trims', () => {
    expect(pos('Auto Trimmer 2')).toEqual(['2466123-3'])
  })

  it('lists open orders no forming run is planned for', () => {
    expect(model.unplanned.map((p) => p.po)).toEqual(expect.arrayContaining(['2466123-3', '2573712']))
    expect(model.unplanned.map((p) => p.po)).not.toContain('2679868')
  })

  it('names where efdashboard.com Line Usage disagrees with the plan', () => {
    expect(model.differences.map((d) => d.machine)).toEqual(['Machine 1', 'Machine 7', 'Machine 8'])
  })

  it('groups products into families for colour', () => {
    expect(familyOf('PHTRASCM')).toBe('medical')
    expect(familyOf('Platinum C2')).toBe('platinum')
    expect(familyOf('1/2M Bowl')).toBe('other')
  })
})
