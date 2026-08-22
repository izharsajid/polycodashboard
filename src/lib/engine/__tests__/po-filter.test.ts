import { describe, expect, it } from 'vitest'
import ledgerRaw from '../../../../data/polyco-ledger.json'
import trackerRaw from '../../../../data/po-tracker.json'
import { Ledger, PoTracker } from '../../schema'
import {
  NOT_DISPATCHED, NO_FILTERS, PRODUCT_FAMILIES, dispatchMonths, familiesFor, filterOrders,
  groupOrders, ledgerRowsFor, orderStatuses, pillCounts, summarise, type PoFilters,
} from '../po-filter'

const ledger = Ledger.parse(ledgerRaw)
const tracker = PoTracker.parse(trackerRaw)
const orders = tracker.orders

const withFilters = (over: Partial<PoFilters> = {}): PoFilters => ({ ...NO_FILTERS, ...over })

describe('product families', () => {
  it('reads the family out of the product text', () => {
    expect(familiesFor('Oasis Tray OT1230')).toEqual(['Oasis'])
    expect(familiesFor('Platinum Trays')).toEqual(['Platinum'])
    expect(familiesFor('PointFive ET #3 Tray + Lid')).toEqual(['PointFive'])
    expect(familiesFor('Point Five')).toEqual(['PointFive'])
  })

  it('gives an order more than one family where it genuinely has two', () => {
    // An Oasis tray for Aspen is both, and the source gives no basis for choosing.
    expect(familiesFor('Aspen Oasis Endoscopy Tray OT1230').sort()).toEqual(['Aspen', 'Oasis'])
  })

  it('treats Northwest Frozen as NWF, as the product codes already do', () => {
    expect(familiesFor('Meal Tray TFNWF/MEAL')).toEqual(['NWF'])
    expect(familiesFor('Northwest Frozen Appetizer Tray')).toEqual(['NWF'])
  })

  it('falls back to Other rather than dropping an order', () => {
    expect(familiesFor('Small, Medium, Large Medical Clamshells')).toEqual(['Other'])
    expect(familiesFor('Madison Oyster Tray')).toEqual(['Other'])
  })

  it('leaves no order without a family', () => {
    for (const order of orders) expect(familiesFor(order.product).length).toBeGreaterThan(0)
  })
})

describe('filtering', () => {
  it('shows everything when nothing is chosen', () => {
    expect(filterOrders(orders, NO_FILTERS)).toHaveLength(orders.length)
  })

  it('combines across rows and unions within one', () => {
    const oasis = filterOrders(orders, withFilters({ families: ['Oasis'] }))
    const platinum = filterOrders(orders, withFilters({ families: ['Platinum'] }))
    const both = filterOrders(orders, withFilters({ families: ['Oasis', 'Platinum'] }))

    // Within a row it is a union, so both is at least as large as either.
    expect(both.length).toBeGreaterThanOrEqual(Math.max(oasis.length, platinum.length))

    // Across rows it narrows.
    const narrowed = filterOrders(
      orders,
      withFilters({ families: ['Oasis'], statuses: ['Dispatched'] }),
    )
    expect(narrowed.length).toBeLessThanOrEqual(oasis.length)
  })

  it('searches the PO number and the product, and nothing else', () => {
    const byPo = filterOrders(orders, withFilters({ search: '2678631' }))
    expect(byPo.length).toBeGreaterThan(0)
    expect(byPo.every((o) => o.po_number.includes('2678631'))).toBe(true)

    const byProduct = filterOrders(orders, withFilters({ search: 'dumpling' }))
    expect(byProduct.every((o) => /dumpling/i.test(o.product))).toBe(true)

    // A container reference lives in remarks and is deliberately not searched.
    expect(filterOrders(orders, withFilters({ search: 'MSMU8240088' }))).toHaveLength(0)
  })

  it('buckets an order with no dispatch date as not dispatched', () => {
    const notGone = filterOrders(orders, withFilters({ months: [NOT_DISPATCHED] }))
    expect(notGone.length).toBeGreaterThan(0)
    expect(notGone.every((o) => o.dispatched_date === null)).toBe(true)
  })

  it('lists the undispatched bucket ahead of the months, newest month first', () => {
    const months = dispatchMonths(orders)
    expect(months[0]).toBe(NOT_DISPATCHED)

    const rest = months.slice(1)
    expect([...rest].sort().reverse()).toEqual(rest)
  })
})

describe('pill counts', () => {
  it('counts every family, and totals more than the orders because a tag is not a share', () => {
    const counts = pillCounts(orders, NO_FILTERS)
    for (const family of PRODUCT_FAMILIES) expect(counts.families).toHaveProperty(family)

    expect(counts.families.Oasis).toBe(43)
    expect(counts.families.Cygnus).toBe(1)

    // 107 across 102 orders: five orders carry two tags, such as an Oasis tray
    // for Aspen. A count means "orders carrying this tag", not a slice of a pie.
    const total = Object.values(counts.families).reduce((a, b) => a + b, 0)
    expect(total).toBeGreaterThan(orders.length)
  })

  it('shows a zero rather than hiding a pill that would find nothing', () => {
    // Section 6: a pill count never lies. Only one cancelled order exists and it
    // is a PointFive, so every other family reads zero against that status.
    const counts = pillCounts(orders, withFilters({ statuses: ['Cancelled'] }))

    expect(counts.families.PointFive).toBe(1)
    expect(counts.families.Oasis).toBe(0)
    expect(counts.families.Platinum).toBe(0)
  })

  it('counts against the other active rows, not against everything', () => {
    const all = pillCounts(orders, NO_FILTERS)
    const narrowed = pillCounts(orders, withFilters({ statuses: ['Dispatched'] }))

    expect(narrowed.families.Oasis).toBeLessThanOrEqual(all.families.Oasis)
    // And it agrees with actually applying that combination.
    expect(narrowed.families.Oasis).toBe(
      filterOrders(orders, withFilters({ statuses: ['Dispatched'], families: ['Oasis'] })).length,
    )
  })

  it('is unaffected by the current selection within its own row', () => {
    // Otherwise choosing one pill would zero every other pill beside it.
    const a = pillCounts(orders, withFilters({ families: ['Oasis'] }))
    const b = pillCounts(orders, withFilters({ families: ['Platinum'] }))
    expect(a.families.Destiny).toBe(b.families.Destiny)
  })

  it('reports only the statuses the data actually holds', () => {
    const statuses = orderStatuses(orders)
    // The spec expects `PO pending` and `On hold`; neither is in po_data.
    expect(statuses).not.toContain('PO pending')
    expect(statuses).toContain('Dispatched')
    // Two spellings of the same airfreight status, logged in OPEN-QUESTIONS.
    expect(statuses.filter((s) => /expeditors/i.test(s))).toHaveLength(2)
  })
})

describe('grouping', () => {
  it('puts what has not gone first, and orders the dispatched newest first', () => {
    const groups = groupOrders(orders)

    expect(groups.open.every((o) => o.dispatched_date === null)).toBe(true)
    expect(groups.dispatched.every((o) => o.dispatched_date !== null)).toBe(true)
    expect(groups.open.length + groups.dispatched.length).toBe(orders.length)

    const dates = groups.dispatched.map((o) => o.dispatched_date!)
    expect([...dates].sort().reverse()).toEqual(dates)
  })

  it('summarises what is on screen', () => {
    const summary = summarise(orders)
    expect(summary.visible).toBe(orders.length)
    expect(summary.notDispatched + summary.dispatched).toBe(summary.visible)
    expect(summary.dispatched).toBe(78)
  })
})

describe('the ledger lines behind an order', () => {
  it('finds them on an exact reference', () => {
    const found = ledgerRowsFor('2678631-1', ledger)
    expect(found.exact).toBe(true)
    expect(found.rows.length).toBeGreaterThan(0)
  })

  it('falls back to the base number, and says that it did', () => {
    // 2465639-2 in the tracker is 2465639 in the ledger.
    const found = ledgerRowsFor('2465639-2', ledger)
    expect(found.exact).toBe(false)
    expect(found.rows.map((r) => r.po_number)).toContain('2465639')
  })

  it('returns nothing rather than guessing when there is no match', () => {
    expect(ledgerRowsFor('9999999-9', ledger).rows).toHaveLength(0)
  })
})
