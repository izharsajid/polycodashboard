/**
 * The machines against the Production Machine Flow workbook (Thermoforming and
 * Finishing Department sheets, latest 1 October 2026) and the efdashboard.com
 * PO snapshot of 30 September.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  agenda,
  buildMachines,
  familyOf,
  gaps,
  hasPo,
  MachinePlan,
  nowOf,
  timeline,
  upcoming,
  withoutPo,
  type Order,
} from '../src/engine/machines'
import { buildTracker } from '../src/engine/tracker'
import { TrackerPayload } from '../src/engine/trackerSchema'

const read = (p: string) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'))
const payload = TrackerPayload.parse(read('./fixtures/tracker-2026-09-30.json'))
const plan = MachinePlan.parse(read('../data/machine-plan.json'))
const model = buildMachines(plan, buildTracker(payload))
const machine = (name: string) => model.machines.find((m) => m.name === name)!
const bars = (name: string) => timeline(machine(name), model.range).map((b) => [b.product, b.from, b.to])
const run = (name: string, product: string) => machine(name).runs.find((r) => r.product === product)!
const poOf = (o: Order) => (o.kind === 'po' ? o.po?.po ?? null : null)
const named = (name: string) => [...new Set(machine(name).runs.flatMap((r) => r.orders.map(poOf)).filter(Boolean))].sort()

describe('the plan', () => {
  it('runs from September, the month before the plan, to the end of December', () => {
    expect(model.months).toEqual(['2026-09', '2026-10', '2026-11', '2026-12'])
    expect(model.range).toEqual({ from: '2026-09-01', to: '2026-12-31' })
  })

  it('takes all fifteen machines from the two sheets, and nothing else', () => {
    expect(model.machines).toHaveLength(15)
    expect(model.machines.filter((m) => m.type === 'forming')).toHaveLength(8)
    expect(model.machines.filter((m) => m.type === 'xray')).toEqual([])
  })

  it('names no PO that was removed from the dashboard', () => {
    const removed: string[] = read('../data/removed-pos.json').pos
    const text = JSON.stringify(read('../data/machine-plan.json'))
    for (const po of removed) expect(text).not.toContain(po)
  })
})

describe('thermoforming', () => {
  it('changes Machine 1 from the large medical tray to Platinum C3 to the 1/2M lid, and stops it on 30 December', () => {
    expect(bars('Machine 1')).toEqual([
      ['Large Medical Tray', '2026-09-01', '2026-09-28'],
      ['Platinum C3', '2026-09-29', '2026-10-09'],
      ['1/2M Lid', '2026-10-10', '2026-12-30'],
    ])
    expect(machine('Machine 1').stops).toBe('2026-12-30')
  })

  it('has Machine 4 in maintenance, continuing with Oasis Tray #2 and no end date', () => {
    const now = nowOf(machine('Machine 4'), '2026-10-06')
    expect(now.state).toBe('maintenance')
    expect(now.state === 'maintenance' && now.bar?.product).toBe('Oasis Tray #2')
    expect(machine('Machine 4').stops).toBeNull()
  })

  it('leaves Machine 7 idle through September, then runs it on to the Potato tray with no end date', () => {
    expect(gaps(machine('Machine 7'), model.range)).toEqual([{ from: '2026-09-01', to: '2026-09-30' }])
    expect(bars('Machine 7')).toEqual([
      ['Small Medical Tray', '2026-10-01', '2026-10-09'],
      ['1/2M Bowl', '2026-10-10', '2026-12-29'],
      ['Potato Tray', '2026-12-30', '2026-12-31'],
    ])
    expect(machine('Machine 7').stops).toBeNull()
    expect(timeline(machine('Machine 7'), model.range).at(-1)!.runsOn).toBe(true)
  })

  it('keeps the start dates the sheet gives, before the chart begins', () => {
    expect(run('Machine 2', 'Platinum C2').from).toBe('2026-08-12')
    expect(run('Machine 6', 'Medium Medical Tray').from).toBe('2026-08-06')
    expect(run('Machine 6', 'Oasis Plus Tray').from).toBe('2026-07-09')
  })

  it('stops Machines 5, 6 and 8 when their POs are completed', () => {
    expect(['Machine 5', 'Machine 6', 'Machine 8'].map((n) => machine(n).stops)).toEqual(['2026-10-30', '2026-10-25', '2026-10-20'])
    expect(nowOf(machine('Machine 8'), '2026-10-21')).toEqual({ state: 'stopped', on: '2026-10-20' })
  })
})

describe('finishing', () => {
  it('runs Auto Trimmer 1 alongside Lamination Machine 1, and Auto Trimmer 2 alongside Lamination Machine 2', () => {
    expect(bars('Auto Trimmer 1')).toEqual(bars('Lamination Machine 1'))
    expect(bars('Auto Trimmer 2')).toEqual(bars('Lamination Machine 2'))
    expect(named('Auto Trimmer 1')).toEqual(named('Lamination Machine 1'))
  })

  it('stands Lamination Machine 1 idle from 26 October to 19 November', () => {
    expect(gaps(machine('Lamination Machine 1'), model.range)).toEqual([{ from: '2026-10-26', to: '2026-11-19' }])
    expect(nowOf(machine('Lamination Machine 1'), '2026-11-01')).toMatchObject({ state: 'idle', bar: { product: 'Platinum 1', from: '2026-11-20' } })
  })

  it('starts Manual Trimmer 3 on 10 October', () => {
    expect(nowOf(machine('Manual Trimmer 3'), '2026-10-06')).toMatchObject({ state: 'starts', bar: { from: '2026-10-10' } })
  })

  it('puts each manual trimmer alongside the forming machine making the same product', () => {
    const names = (n: string, p: string) => run(n, p).alongside.map((m) => m.name)
    expect(names('Manual Trimmer 1', 'Oasis Tray')).toEqual(['Machine 3', 'Machine 4'])
    expect(names('Manual Trimmer 2', 'Medium Medical Tray')).toEqual(['Machine 6'])
    expect(names('Manual Trimmer 3', '1/2M Lid')).toEqual(['Machine 1'])
  })
})

describe('the POs the sheets name', () => {
  it('ties Machine 2 to the one Platinum PO the sheet names, not every Platinum order', () => {
    expect(named('Machine 2')).toEqual(['2679969', '2679971'])
  })

  it('finds a PO the sheet writes with a lot number efdashboard.com does not use', () => {
    const [o] = run('Machine 1', 'Large Medical Tray').orders
    expect(o.kind === 'po' && [o.ref, o.po?.po]).toEqual(['2679868-1', '2679868'])
  })

  it('shows only the quantity a run makes for a PO with several products', () => {
    const [o] = run('Machine 1', 'Large Medical Tray').orders
    expect(o.kind === 'po' && o.quantities.map((q) => q.label)).toEqual(['Aspen Single Cycle Tray Large (PHTRASCL)'])
  })

  it('shows efdashboard.com status beside the sheet, even where efdashboard.com is ahead', () => {
    const [o] = run('Machine 5', 'Point Five Tray').orders
    expect(o.kind === 'po' && [o.po?.po, o.po?.state.key]).toEqual(['2679683-3', 'dispatched'])
  })

  it('finds every PO the plan names on efdashboard.com', () => {
    const missing = model.machines.flatMap((m) => m.runs.flatMap((r) => r.orders)).filter((o) => o.kind === 'po' && !o.po)
    expect(missing).toEqual([])
  })

  it('marks a run with nothing but POs still required as having no PO', () => {
    expect(hasPo(run('Machine 1', '1/2M Lid'))).toBe(false)
    expect(hasPo(run('Machine 3', 'Oasis Tray #1'))).toBe(true)
    expect(hasPo(run('Manual Trimmer 1', 'Oasis Tray'))).toBe(true)
  })
})

describe('work planned without a PO', () => {
  const rows = withoutPo(model.machines, '2026-10-06')
  const row = (product: string, kind: string) => rows.find((r) => r.product === product && r.kind === kind)!

  it('lists the POs still required, one row per product', () => {
    expect(rows.filter((r) => r.kind === 'required').map((r) => [r.product, r.count])).toEqual([
      ['1/2M Lid', 3],
      ['Oasis Tray', 3],
      ['1/2M Bowl', 3],
    ])
  })

  it('groups machines that run the same dates', () => {
    const bowl = row('1/2M Bowl', 'required')
    expect(bowl.where.map((w) => w.machines.map((m) => m.name))).toEqual([
      ['Machine 7'],
      ['Lamination Machine 2', 'Auto Trimmer 2'],
    ])
    expect(bowl.where[1].spans).toHaveLength(3)
  })

  it('carries the sheets’ own words for work made with no PO', () => {
    expect(rows.filter((r) => r.kind === 'no-po').map((r) => r.text)).toEqual(
      expect.arrayContaining(['Extra one producing', 'One PO extra produced, PO not yet received', 'Monthly one, no PO']),
    )
  })

  it('lists runs with no PO at all, leaving out trimmers working alongside a forming machine', () => {
    expect(rows.filter((r) => r.kind === 'none').map((r) => r.product).sort()).toEqual(['Every Table', 'Potato Tray'])
  })
})

describe('open orders on no plan', () => {
  it('lists open efdashboard.com orders no run names', () => {
    const pos = model.unplanned.map((p) => p.po)
    expect(pos).toEqual(expect.arrayContaining(['2679867', '2573712']))
    for (const p of ['2679868', '2466123-3', '2680266-1', '2679969', '2679971']) expect(pos).not.toContain(p)
  })
})

describe('what is still to run', () => {
  it('lists runs and idle stretches from a given day', () => {
    expect(upcoming(machine('Machine 1'), '2026-10-12').map((b) => b.product)).toEqual(['1/2M Lid'])
    expect(upcoming(machine('Machine 8'), '2026-10-21')).toEqual([])
    expect(agenda(machine('Lamination Machine 1'), '2026-10-20').map((a) => (a.kind === 'run' ? a.bar.product : 'idle'))).toEqual([
      'Platinum 2',
      'idle',
      'Platinum 1',
      'Platinum 2',
    ])
  })

  it('groups products into families for colour', () => {
    expect(familyOf('Large Medical Tray')).toBe('medical')
    expect(familyOf('Platinum C2')).toBe('platinum')
    expect(familyOf('Potato Tray')).toBe('destiny')
    expect(familyOf('Every Table')).toBe('pointfive')
    expect(familyOf('1/2M Bowl')).toBe('halfm')
  })
})
