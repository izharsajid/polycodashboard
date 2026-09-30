/**
 * The PO tracker against a snapshot of efdashboard.com taken on 30 September
 * 2026. The expected counts are the ones efdashboard.com's own page showed at
 * that moment, so this proves the two sites filter and group alike.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildTracker, dispatchQuantityLines, filterPills, filterTracker, groupTracker, NO_FILTERS, parsePoDate } from '../src/engine/tracker'
import { TrackerPayload } from '../src/engine/trackerSchema'

const tracker = buildTracker(
  TrackerPayload.parse(JSON.parse(readFileSync(new URL('./fixtures/tracker-2026-09-30.json', import.meta.url), 'utf8'))),
)

describe('the default view, as efdashboard.com showed it', () => {
  const rows = filterTracker(tracker, NO_FILTERS)
  const groups = groupTracker(rows)

  it('shows 39 orders: 8 not dispatched and 31 dispatched', () => {
    expect(rows).toHaveLength(39)
    expect(groups.map((g) => [g.label, g.rows.length])).toEqual([
      ['Open / awaiting dispatch', 8],
      ['Dispatched', 31],
    ])
  })

  it('counts each product pill the same', () => {
    const pills = filterPills(tracker, NO_FILTERS).products.map((p) => [p.label, p.count])
    expect(pills).toEqual([
      ['All products', 39], ['Oasis', 16], ['PointFive', 6], ['Destiny', 5], ['Platinum', 6],
      ['Cygnus', 18], ['NWF', 1], ['Aspen', 8], ['Other Trays', 1],
    ])
  })

  it('counts each status pill the same', () => {
    const pills = filterPills(tracker, NO_FILTERS).statuses.map((p) => [p.label, p.count])
    expect(pills).toEqual([
      ['All statuses', 39], ['Dispatched', 31], ['Container confirmed', 1], ['Container requested', 1], ['Processing', 6],
    ])
  })

  it('lists the open orders in efdashboard.com order', () => {
    expect(groups[0].rows.map((p) => p.po)).toEqual([
      '2679868', '2679867', '2466123-3', '2680266-1', '2679969', '2680265-1', '2573712', '2679971',
    ])
  })

  it('carries the former number, the internal order and the documents', () => {
    const renamed = tracker.byPo.get('2679683-3')!
    expect(renamed.formerPo).toBe('2678252-1')
    expect(tracker.byPo.get('462549')!.isInternal).toBe(true)
    expect(tracker.byPo.get('2680213-1')!.documents.map((d) => d.title)).toContain('Polyco Invoice')
  })
})

describe('efdashboard.com rules', () => {
  it('reads dates day first', () => {
    expect(parsePoDate('11-Jul-2026')).toBe('2026-07-11')
    expect(parsePoDate('5/7/2026')).toBe('2026-07-05')
    expect(parsePoDate('31-Feb-2026')).toBeNull()
  })

  it('ticks dispatch quantities', () => {
    expect(dispatchQuantityLines(tracker.byPo.get('2679713')!)).toEqual(['4,000 bags ✅'])
  })

  it('shows inactive orders only when asked', () => {
    const all = filterTracker(tracker, { ...NO_FILTERS, showInactive: true })
    expect(groupTracker(all).map((g) => g.label)).toContain('Inactive POs')
  })
})
