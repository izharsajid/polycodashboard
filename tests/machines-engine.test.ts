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
  inMonth,
  monthSpan,
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
  it('runs from August, the first month on the plan, to the end of December', () => {
    expect(model.months).toEqual(['2026-08', '2026-09', '2026-10', '2026-11', '2026-12'])
    expect(model.range).toEqual({ from: '2026-08-01', to: '2026-12-31' })
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
  it('changes Machine 1 from the large medical tray to Platinum C3 to the 1/2M lid on 15 October, and stops it on 30 December', () => {
    expect(bars('Machine 1')).toEqual([
      ['Destiny 7x7 Tray', '2026-08-01', '2026-08-05'],
      ['Large Medical Tray', '2026-08-06', '2026-09-28'],
      ['Platinum C3', '2026-09-29', '2026-10-14'],
      ['1/2M Lid', '2026-10-15', '2026-12-30'],
    ])
    expect(machine('Machine 1').stops).toBe('2026-12-30')
  })

  it('has Machine 4 in maintenance, continuing with Oasis Tray #2 and no end date', () => {
    const now = nowOf(machine('Machine 4'), '2026-10-06')
    expect(now.state).toBe('maintenance')
    expect(now.state === 'maintenance' && now.bar?.product).toBe('Oasis Tray #2')
    expect(machine('Machine 4').stops).toBeNull()
  })

  it('leaves Machine 7 idle through September, then runs it on to the Destiny 7x7 Tray with no end date', () => {
    expect(gaps(machine('Machine 7'), model.range)).toEqual([{ from: '2026-09-01', to: '2026-09-30' }])
    expect(bars('Machine 7')).toEqual([
      ['Destiny 7x7 Tray', '2026-08-01', '2026-08-31'],
      ['Small Medical Tray', '2026-10-01', '2026-10-14'],
      ['1/2M Bowl', '2026-10-15', '2026-12-29'],
      ['Destiny 7x7 Tray', '2026-12-30', '2026-12-31'],
    ])
    expect(machine('Machine 7').stops).toBeNull()
    expect(timeline(machine('Machine 7'), model.range).at(-1)!.runsOn).toBe(true)
  })

  it('keeps the start dates the sheet gives, before the chart begins', () => {
    expect(run('Machine 2', 'Platinum C2').from).toBe('2026-08-12')
    expect(run('Machine 6', 'Medium Medical Tray').from).toBe('2026-08-06')
    expect(run('Machine 6', 'Oasis Plus Tray').from).toBe('2026-07-09')
  })

  it('stops Machine 5 after 29 September, and Machines 6 and 8 when their POs are completed', () => {
    expect(['Machine 5', 'Machine 6', 'Machine 8'].map((n) => machine(n).stops)).toEqual(['2026-09-29', '2026-10-25', '2026-10-20'])
    expect(bars('Machine 5')).toEqual([['Point Five Tray', '2026-08-01', '2026-09-29']])
    expect(nowOf(machine('Machine 5'), '2026-10-06')).toEqual({ state: 'stopped', on: '2026-09-29' })
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

  it('starts Manual Trimmer 3 on 15 October', () => {
    expect(nowOf(machine('Manual Trimmer 3'), '2026-10-06')).toMatchObject({ state: 'starts', bar: { from: '2026-10-15' } })
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

  it('counts a PO received, though not yet on efdashboard.com, as a PO behind the run', () => {
    expect(hasPo(run('Machine 1', '1/2M Lid'))).toBe(true)
    expect(hasPo(run('Machine 3', 'Oasis Tray #1'))).toBe(true)
    expect(hasPo(run('Manual Trimmer 1', 'Oasis Tray'))).toBe(true)
  })
})

describe('work planned without a PO', () => {
  const rows = withoutPo(model.machines, '2026-10-06')

  it('lists the POs still required, one row per product', () => {
    expect(rows.filter((r) => r.kind === 'required').map((r) => [r.product, r.count])).toEqual([['Oasis Tray', 3]])
  })

  it('groups machines that run the same dates', () => {
    const monthly = rows.find((r) => r.kind === 'no-po' && r.text === 'Monthly one, no PO')!
    expect(monthly.where.map((w) => w.machines.map((m) => m.name))).toEqual([['Lamination Machine 2', 'Auto Trimmer 2']])
    expect(monthly.where[0].spans).toHaveLength(3)
  })

  it('carries the sheets’ own words for work made with no PO', () => {
    expect(rows.filter((r) => r.kind === 'no-po').map((r) => r.text)).toEqual(
      expect.arrayContaining(['One PO extra produced, PO not yet received', 'Monthly one, no PO']),
    )
    // No extra Point Five is being made now.
    expect(rows.filter((r) => r.kind === 'no-po' && /point five/i.test(r.product))).toEqual([])
  })

  it('lists runs with no PO at all, leaving out trimmers working alongside a forming machine', () => {
    expect(rows.filter((r) => r.kind === 'none').map((r) => r.product).sort()).toEqual(['Destiny 7x7 Tray', 'Point Five Tray'])
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
    expect(upcoming(machine('Machine 1'), '2026-10-12').map((b) => b.product)).toEqual(['Platinum C3', '1/2M Lid'])
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
    expect(familyOf('Destiny 7x7 Tray')).toBe('destiny')
    expect(familyOf('Point Five Tray')).toBe('pointfive')
    expect(familyOf('1/2M Bowl')).toBe('halfm')
  })
})

describe('the plant floor', () => {
  it('reads the floor layout: two back-to-back lines of four formers, then lamination, then trimming', () => {
    const plan = MachinePlan.parse(read('../data/machine-plan.json'))
    expect(plan.floor.forming_rows.map((r) => r.length)).toEqual([4, 4])
    expect(plan.floor.lamination).toHaveLength(2)
    expect(plan.floor.trimming).toHaveLength(5)
  })

  it('refuses a floor that names a machine the plan does not have', () => {
    const plan = read('../data/machine-plan.json')
    plan.floor.lamination = ['lamination-9']
    expect(() => MachinePlan.parse(plan)).toThrow(/lamination-9/)
  })
})

describe('the plan of 6 October', () => {
  it('writes every product by its name, never by the old ones', () => {
    const names = model.machines.flatMap((m) => m.runs.map((r) => r.product))
    expect(names.some((n) => /potato|every ?table/i.test(n))).toBe(false)
    expect(names).toContain('Destiny 7x7 Tray')
    expect(names).toContain('Point Five Tray')
  })

  it('starts the 1/2M lid and bowl on 15 October', () => {
    expect(run('Machine 1', '1/2M Lid').from).toBe('2026-10-15')
    expect(run('Machine 7', '1/2M Bowl').from).toBe('2026-10-15')
    expect(run('Manual Trimmer 3', '1/2M Lid').from).toBe('2026-10-15')
  })

  it('carries the three 1/2M POs received, for October, November and December, as backed by a PO', () => {
    const lid = run('Machine 1', '1/2M Lid')
    expect(lid.orders.map((o) => o.kind)).toEqual(['received', 'received', 'received'])
    expect(hasPo(lid)).toBe(true)
    const bowls = machine('Lamination Machine 2').runs.filter((r) => r.product === '1/2M Bowl')
    expect(bowls.map((r) => r.orders.map((o) => (o.kind === 'received' ? o.text : o.kind)))).toEqual([
      ['PO received, delivery October 2026'],
      ['PO received, delivery November 2026'],
      ['PO received, delivery December 2026'],
    ])
  })

  it('shows the months from August, as Izhar asked', () => {
    expect(model.months[0]).toBe('2026-08')
  })
})

describe('one month at a time', () => {
  it('gives the month as a span', () => {
    expect(monthSpan('2026-11')).toEqual({ from: '2026-11-01', to: '2026-11-30' })
  })

  it('says whether a machine runs in the month, and the last day it runs there', () => {
    expect(inMonth(machine('Machine 8'), '2026-10')).toEqual({ running: true, to: '2026-10-20', runsOn: false })
    expect(inMonth(machine('Machine 6'), '2026-11')).toEqual({ running: false, to: null, runsOn: false })
    expect(inMonth(machine('Machine 3'), '2026-10')).toMatchObject({ running: true, runsOn: true })
    expect(inMonth(machine('Machine 1'), '2026-10')).toMatchObject({ running: true, runsOn: true })
  })

  it('counts the machines running in each month', () => {
    const running = (month: string) => model.machines.filter((m) => inMonth(m, month).running).length
    expect(running('2026-10')).toBeGreaterThan(running('2026-12'))
  })
})
