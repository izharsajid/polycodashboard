import { describe, expect, it } from 'vitest'
import ledgerRaw from '../../../../data/polyco-ledger.json'
import trackerRaw from '../../../../data/po-tracker.json'
import { Ledger, PoTracker } from '../../schema'
import { reconcileTracker, trackerBegins } from '../po-tracker'

const ledger = Ledger.parse(ledgerRaw)
const tracker = PoTracker.parse(trackerRaw)

describe('the tracker file', () => {
  it('parses, and says when it was pulled', () => {
    expect(tracker.source).toContain('po_data')
    expect(tracker.orders.length).toBe(tracker.row_count)
    expect(Date.parse(tracker.pulled_at)).not.toBeNaN()
  })

  it('keeps the source text beside any date it could parse', () => {
    const dated = tracker.orders.filter((o) => o.dispatched_date !== null)
    expect(dated.length).toBeGreaterThan(0)
    for (const order of dated) {
      expect(order.dispatched).not.toBe('')
      expect(order.dispatched_date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })

  it('invents no date for a field holding something that is not one', () => {
    // cargo_ready carries "ON HOLD (Miami)" and "CARGO READY" as well as dates.
    const wordy = tracker.orders.filter((o) => o.cargo_ready !== '' && o.cargo_ready_date === null)
    expect(wordy.length).toBeGreaterThan(0)
    for (const order of wordy) expect(order.cargo_ready_date).toBeNull()
  })
})

describe('reconciling against the ledger', () => {
  const recon = reconcileTracker(tracker, ledger)

  it('accounts for every order in the tracker, once', () => {
    const total = recon.exact.length + recon.suffixOnly.length + recon.trackerOnly.length
    expect(total).toBe(recon.trackerCount)
  })

  it('accounts for every PO number in the ledger, once', () => {
    const total = recon.exact.length + recon.suffixOnly.length + recon.ledgerOnly.length
    expect(total).toBe(recon.ledgerCount)
  })

  it('matches the bulk of the tracker on the PO number alone', () => {
    expect(recon.exact.length).toBe(78)
  })

  it('reports a suffix difference rather than merging it away', () => {
    expect(recon.suffixOnly.length).toBe(13)
    // The disagreement runs both ways: the ledger is bare for some, the tracker
    // for others, which is why neither side can be treated as the correct form.
    expect(recon.suffixOnly.some((m) => m.ledgerPo === m.base)).toBe(true)
    expect(recon.suffixOnly.some((m) => m.trackerPo === m.base)).toBe(true)
  })

  it('will not guess when a base number is ambiguous', () => {
    // 2466124 and 2467665 each have two ledger lines. A base match there would be
    // picking one at random, so both stay unmatched and visible.
    const bases = recon.suffixOnly.map((m) => m.base)
    expect(bases).not.toContain('2466124')
    expect(bases).not.toContain('2467665')
    expect(recon.ledgerOnly.map((r) => r.po_number)).toContain('2466124-1')
  })

  it('leaves nothing matched twice', () => {
    const trackerSide = [...recon.exact, ...recon.suffixOnly.map((m) => m.trackerPo)]
    const ledgerSide = [...recon.exact, ...recon.suffixOnly.map((m) => m.ledgerPo)]
    expect(new Set(trackerSide).size).toBe(trackerSide.length)
    expect(new Set(ledgerSide).size).toBe(ledgerSide.length)
  })

  it('finds the orders that have not reached the ledger yet', () => {
    expect(recon.trackerOnly.length).toBe(11)
    // Nothing dispatched sits here: an order that shipped should have a delivery.
    expect(recon.trackerOnly.every((o) => o.order_status !== 'Dispatched')).toBe(true)
  })

  it('finds the ledger deliveries the tracker never covered', () => {
    expect(recon.ledgerOnly.length).toBe(25)

    const begins = trackerBegins(tracker)!
    const dated = recon.ledgerOnly.filter((r) => r.delivery_date !== null)
    // All but the undated ones predate the tracker, which is an explanation
    // rather than a discrepancy.
    expect(dated.every((r) => r.delivery_date! < begins)).toBe(true)
  })

  it('knows when the tracker begins', () => {
    expect(trackerBegins(tracker)).toBe('2024-11-07')
  })
})

describe('the matching rules, on a small made-up set', () => {
  const order = (po: string) =>
    ({
      id: 1, row_no: '1', po_number: po, product: 'Tray', film: '', rolls: '', qty: '',
      order_status: 'Booked', cargo_ready: '', cargo_ready_date: null, dispatched: '',
      dispatched_date: null, remarks: '', is_new: false, sort_order: 1,
    }) as const

  const row = (po: string) =>
    ({
      source_row: 1, ref: po, po_number: po, product: null, type: 'delivery' as const,
      po_amount: null, proforma_ref: null, proforma_amount: null, delivered_value: null,
      received: null, received_date: null, received_date_source: null, loaded: null,
      delivery_date: null, delivery_date_source: null, flags: [],
    }) as unknown as Parameters<typeof reconcileTracker>[1]['rows'][number]

  const build = (trackerPos: string[], ledgerPos: string[]) =>
    reconcileTracker(
      { source: 's', pulled_at: '2026-01-01T00:00:00.000Z', row_count: trackerPos.length, orders: trackerPos.map(order) },
      { source: 's', currency: 'USD', summary: ledger.summary, rows: ledgerPos.map(row) },
    )

  it('ignores case and surrounding space', () => {
    expect(build([' 123-1 '], ['123-1']).exact).toEqual(['123-1'])
  })

  it('pairs a bare reference with a suffixed one, either way round', () => {
    expect(build(['500-1'], ['500']).suffixOnly).toEqual([
      { trackerPo: '500-1', ledgerPo: '500', base: '500' },
    ])
    expect(build(['500'], ['500-1']).suffixOnly).toEqual([
      { trackerPo: '500', ledgerPo: '500-1', base: '500' },
    ])
  })

  it('refuses a suffix match when two ledger lines share the base', () => {
    const recon = build(['500'], ['500-1', '500-2'])
    expect(recon.suffixOnly).toEqual([])
    expect(recon.trackerOnly).toHaveLength(1)
    expect(recon.ledgerOnly).toHaveLength(2)
  })

  it('prefers an exact match over a suffix one', () => {
    const recon = build(['500-1'], ['500-1', '500'])
    expect(recon.exact).toEqual(['500-1'])
    expect(recon.suffixOnly).toEqual([])
    expect(recon.ledgerOnly.map((r) => r.po_number)).toEqual(['500'])
  })
})
