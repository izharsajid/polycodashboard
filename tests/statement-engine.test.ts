/**
 * The live statement against the workbook as issued and the efdashboard.com
 * snapshot of 30 September 2026.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildStatement, readDate, readPo } from '../src/engine/statement'
import { LedgerDisputes, Workbook, type EntryT } from '../src/engine/statementSchema'
import { buildTracker } from '../src/engine/tracker'
import { TrackerPayload } from '../src/engine/trackerSchema'

const read = (p: string) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'))
const workbook = Workbook.parse(read('../data/polyco-statement.json'))
const tracker = buildTracker(TrackerPayload.parse(read('./fixtures/tracker-2026-09-30.json')))
const disputes = LedgerDisputes.parse(read('../data/ledger-disputes.json'))
const model = buildStatement(workbook, tracker, [], disputes)
const line = (po: string) => model.lines.find((l) => l.po === po && l.kind === 'order')!

const entry = (e: Partial<EntryT>): EntryT => ({
  id: 'e1', kind: 'payment', date: '2026-09-30', amount: 0, invoiceKind: null, po: null, row: null, field: null,
  reference: null, description: 'test', by: 'Test', at: '2026-09-30T12:00:00Z', voided: null, value: null, key: null, ...e,
})

describe('the workbook as issued', () => {
  it('adds up to its own totals row', () => {
    const totals = workbook.summary.find((s) => s.kind === 'totals')!
    const sum = (k: 'received' | 'delivered') =>
      workbook.rows.reduce((a, r) => a + Math.round((typeof r[k] === 'number' ? (r[k] as number) : 0) * 100), 0)
    expect(sum('received')).toBe(Math.round((totals as { received: number }).received * 100))
    expect(sum('delivered')).toBe(Math.round((totals as { delivered: number }).delivered * 100))
  })

  it('reads PO numbers out of free text', () => {
    expect(readPo('PO # 2576574- 1 07/12/2025')?.full).toBe('2576574-1')
    expect(readPo('PO.2465639 - 30/01/24')?.full).toBe('2465639')
    expect(readPo('PO 267775030/04/2026')?.full).toBe('2677750')
    expect(readPo('FIND')).toBeNull()
  })

  it('never confirms a date after the as-at date', () => {
    expect(readDate('2026-11-02', '2026-09-30').status).toBe('disputed')
    expect(readDate('2026-11-02', '2026-09-30').swapped).toBe('2026-02-11')
    expect(readDate('28th Sept 2026', '2026-09-30').date).toBe('2026-09-28')
    expect(readDate('11/06/2023 19/10/23', '2026-09-30').status).toBe('missing')
  })
})

describe('efdashboard.com is the master', () => {
  it('counts an order dispatched there as delivered, even where the workbook says pending', () => {
    const l = line('2679683-3')
    expect(l.status).toBe('delivered')
    expect(l.deliveredCents).toBe(3_150_720)
    expect(l.deliveryDate).toBe('2026-09-30')
  })

  it('keeps an order not yet dispatched out of delivered value, as an open order', () => {
    const l = line('2679868')
    expect(l.status).toBe('awaiting')
    expect(l.deliveredCents).toBe(0)
    expect(l.openCents).toBe(3_874_800)
  })

  it('never counts one dispatch twice when the workbook carries it on two lines', () => {
    const matches = model.lines.filter((l) => l.po === '2679683-3' && l.status === 'delivered')
    expect(matches).toHaveLength(1)
  })

  it('works the exposure out from its parts', () => {
    const p = model.position
    expect(p.balanceCents).toBe(p.receivedCents - p.deliveredCents)
    expect(p.exposureCents).toBe(p.balanceCents - p.awaitingCents - p.onHoldCents)
  })

  it('lists the orders efdashboard.com has and the workbook does not', () => {
    expect(model.masterOnly.map((p) => p.po)).toEqual(expect.arrayContaining(['2679969', '2679971']))
  })
})

describe('discrepancies, one by one', () => {
  const titles = model.discrepancies.map((d) => d.title)

  it('numbers them from one', () => {
    expect(model.discrepancies.map((d) => d.id)).toEqual(model.discrepancies.map((_, i) => i + 1))
  })

  it('finds the row with no PO number, and the row it copies', () => {
    expect(titles).toContain('Row 187 has no PO number')
    expect(titles).toContain('Row 187 may duplicate row 183')
  })

  it('finds the renumbered PO and the broken serials', () => {
    expect(titles).toContain('PO 2678252-1 is now PO 2679683-3')
    expect(titles.some((t) => /rows have a broken serial number/.test(t))).toBe(true)
  })

  it('finds the disputed 220,000.00 receipt', () => {
    expect(model.discrepancies.find((d) => d.row === 122)?.detail).toContain('6 October 2025')
  })
})

describe('changes recorded on this site', () => {
  it('adds a payment to money received', () => {
    const next = buildStatement(workbook, tracker, [entry({ amount: 1000 })], disputes)
    expect(next.position.receivedCents - model.position.receivedCents).toBe(100_000)
  })

  it('adds a recharge invoice to delivered value', () => {
    const next = buildStatement(workbook, tracker, [entry({ kind: 'invoice', invoiceKind: 'recharge', amount: 500 })], disputes)
    expect(next.position.deliveredCents - model.position.deliveredCents).toBe(50_000)
  })

  it('corrects a figure and keeps the one it replaced', () => {
    const next = buildStatement(workbook, tracker, [entry({ kind: 'correction', row: 200, field: 'received', amount: 205689.86 })], disputes)
    const l = next.lines.find((x) => x.row === 200)!
    expect(l.receivedCents).toBe(20_568_986)
    expect(l.corrections[0].fromCents).toBe(20_568_900)
  })

  it('ignores a voided entry', () => {
    const next = buildStatement(workbook, tracker, [entry({ amount: 1000, voided: { by: 'Test', at: 'x', reason: 'entered twice' } })], disputes)
    expect(next.position.receivedCents).toBe(model.position.receivedCents)
  })
})

describe('fixing discrepancies', () => {
  const find = (m: typeof model, title: string) => m.discrepancies.find((d) => d.title === title)!

  it('offers a fix for every discrepancy, each with a stable key', () => {
    for (const d of model.discrepancies) {
      expect(d.fixes.length, d.title).toBeGreaterThan(0)
      expect(d.key, d.title).toMatch(/\S/)
    }
    expect(new Set(model.discrepancies.map((d) => d.key)).size).toBe(model.discrepancies.length)
  })

  it('leaves a copied line out of every total, and marks the discrepancy settled', () => {
    const d = find(model, 'Row 187 may duplicate row 183')
    const next = buildStatement(workbook, tracker, [entry({ kind: 'correction', row: 187, field: 'exclude', description: 'Copy of 2679302-1', key: d.key, reference: d.title })], disputes)
    expect(model.position.deliveredCents - next.position.deliveredCents).toBe(1_940_280)
    expect(next.lines.find((l) => l.row === 187)!.status).toBe('excluded')
    const settled = next.discrepancies.find((x) => x.key === d.key)!
    expect(settled.resolved?.by).toBe('Test')
    expect(settled.title).toBe(d.title)
    expect(next.openDiscrepancies).toBeLessThan(model.openDiscrepancies)
  })

  it('puts an undated receipt into its month once a date is set', () => {
    const next = buildStatement(workbook, tracker, [entry({ kind: 'correction', row: 150, field: 'received_date', value: '2026-02-11', description: 'Bank advice', key: 'receipt-date:row-150' })], disputes)
    const line = next.lines.find((l) => l.row === 150)!
    expect(line.receivedDate).toBe('2026-02-11')
    expect(next.unresolved.length).toBe(model.unresolved.length - 1)
  })

  it('adds a PO efdashboard.com has and the workbook lacks as an open order', () => {
    const next = buildStatement(workbook, tracker, [entry({ kind: 'correction', row: null, field: 'po_amount', po: '2679969', amount: 40000, description: 'PO value', key: 'missing-po:2679969' })], disputes)
    expect(next.position.awaitingCents - model.position.awaitingCents).toBe(4_000_000)
    expect(next.masterOnly.map((p) => p.po)).not.toContain('2679969')
  })

  it('matches a line to the PO assigned to it', () => {
    const next = buildStatement(workbook, tracker, [entry({ kind: 'correction', row: 187, field: 'po', value: '2680213-1', description: 'Assigned', key: 'no-po:row-187' })], disputes)
    expect(next.lines.find((l) => l.row === 187)!.po).toBe('2680213-1')
  })

  it('undoes a fix when its entry is voided', () => {
    const next = buildStatement(workbook, tracker, [entry({ kind: 'correction', row: 187, field: 'exclude', description: 'x', key: 'twin:row-187', voided: { by: 'Test', at: 'x', reason: 'undo' } })], disputes)
    expect(next.position.deliveredCents).toBe(model.position.deliveredCents)
  })
})
