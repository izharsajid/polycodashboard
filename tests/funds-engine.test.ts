/**
 * The engine against the statements as issued. BRIEF-TAB1 section 5.
 *
 * These live outside /src on purpose: they assert business figures, and /src may
 * not carry a business number as a literal. The expected values are the ones the
 * brief verified by hand before handover.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CATEGORIES, matchCategories } from '../src/engine/classify'
import { bridge, buildModel, shownCents } from '../src/engine/funds'
import { FundsRequested } from '../src/engine/schema'
import { amount, range, usd } from '../src/lib/format'

const data = FundsRequested.parse(
  JSON.parse(readFileSync(new URL('../data/funds-requested.json', import.meta.url), 'utf8')),
)
const AS_AT = '2026-09-30'
const model = buildModel(data, AS_AT)
const byId = (id: string) => model.statements.find((s) => s.id === id)!

describe('the record', () => {
  it('holds fourteen statements and 149 lines', () => {
    expect(model.statements).toHaveLength(14)
    expect(model.statements.flatMap((s) => s.lines)).toHaveLength(149)
  })

  it('foots every statement to its own stated total, to the cent', () => {
    for (const raw of data.statements) {
      const lines = raw.lines.reduce((sum, l) => sum + Math.round(l.amount * 100), 0)
      expect(lines, raw.id).toBe(Math.round(raw.stated_total * 100))
      expect(byId(raw.id).statedCents).toBe(Math.round(raw.stated_total * 100))
    }
  })
})

describe('what counts as a request', () => {
  it('totals the 13 requests to US$2,841,167.50', () => {
    expect(model.requestCount).toBe(13)
    expect(model.requestedCents).toBe(284_116_750)
    expect(usd(model.requestedCents)).toBe('US$2,841,167.50')
  })

  it('keeps October 2025 out, because it records actuals, not a request', () => {
    const october = byId('2025-10')
    expect(october.kind).toBe('actuals')
    expect(october.isRequest).toBe(false)
    expect(model.requests.map((s) => s.id)).not.toContain('2025-10')
    expect(model.excluded.map((s) => s.id)).toEqual(['2025-10'])
    const everything = model.statements.reduce((sum, s) => sum + s.statedCents, 0)
    expect(everything).toBe(305_991_050)
    expect(model.requestedCents).not.toBe(everything)
  })

  it('counts August 2025, a request carrying actuals, as a request', () => {
    const august = byId('2025-08')
    expect(august.kind).toBe('request_with_actuals')
    expect(august.isRequest).toBe(true)
    expect(august.lines.filter((l) => l.utilised).reduce((a, l) => a + l.cents, 0)).toBe(9_788_100)
    expect(august.lines.filter((l) => l.utilised === false).reduce((a, l) => a + l.cents, 0)).toBe(9_804_000)
  })

  it('includes November 2025 in every total', () => {
    expect(model.requests.map((s) => s.id)).toContain('2025-11')
    expect(byId('2025-11').flags).toHaveLength(1)
  })

  it('averages US$218,551 in the headline', () => {
    expect(model.averageCents).toBe(21_855_135)
    expect(model.headline).toBe(
      '13 funding requests, June 2025 to August 2026, averaging US$218,551 a month.',
    )
  })
})

describe('categories', () => {
  it('puts every one of the 149 lines in exactly one category, with no catch-all', () => {
    for (const s of data.statements) {
      for (const l of s.lines) {
        expect(matchCategories(l.description), `${s.id}: ${l.description}`).toHaveLength(1)
      }
    }
  })

  it('sums the categories back to the request total', () => {
    expect(model.categoryTotals.reduce((a, c) => a + c.cents, 0)).toBe(model.requestedCents)
    for (const s of model.statements) {
      expect(CATEGORIES.reduce((a, c) => a + s.byCategory[c], 0), s.id).toBe(s.statedCents)
      expect(s.segments.reduce((a, g) => a + g.cents, 0), s.id).toBe(s.statedCents)
    }
  })

  it('shows the customs duty refund as a credit in logistics', () => {
    const credit = byId('2026-07').lines.find((l) => l.cents < 0)!
    expect(credit.cents).toBe(-1_911_000)
    expect(credit.category).toBe('logistics')
    expect(amount(credit.cents)).toBe('(19,110.00)')
    expect(model.statements.flatMap((s) => s.lines).filter((l) => l.cents < 0)).toHaveLength(1)
  })

  it('recomposes a statement over the categories switched on', () => {
    const july = byId('2026-07')
    expect(shownCents(july, new Set(CATEGORIES))).toBe(july.statedCents)
    expect(shownCents(july, new Set(['payroll'] as const))).toBe(july.byCategory.payroll)
  })
})

describe('periods, gaps and the overlap', () => {
  it('names the four statements whose period is not their month', () => {
    expect(model.irregular.map((s) => s.id)).toEqual(['2026-02', '2026-04', '2026-06', '2026-07'])
  })

  it('finds every day no request covers, through to the as-at date', () => {
    expect(model.gaps.map((g) => range(g.start, g.end))).toEqual([
      '1 to 31 Oct 2025',
      '1 to 4 Feb 2026',
      '1 to 9 Apr 2026',
      '1 to 9 Jun 2026',
      '11 to 14 Jul 2026',
      '16 Aug to 30 Sep 2026',
    ])
  })

  it('finds the five days February and March both claim', () => {
    expect(model.overlaps).toEqual([
      { start: '2026-03-01', end: '2026-03-05', days: 5, statementIds: ['2026-02', '2026-03'] },
    ])
  })

  it('stops the last gap at the as-at date, whatever that is', () => {
    const later = buildModel(data, '2026-10-01')
    expect(later.gaps[later.gaps.length - 1].end).toBe('2026-10-01')
    expect(later.recordEnd).toBe('2026-08-15')
  })

  it('lists the four statements with no prepared date', () => {
    expect(model.undated.map((s) => s.id)).toEqual(['2026-04', '2026-05', '2026-06', '2026-07'])
  })
})

describe('comparing two statements', () => {
  it('moves from one total to the other exactly, largest movers first', () => {
    const b = bridge(byId('2026-06'), byId('2026-07'))
    expect(b.steps.reduce((a, s) => a + s.deltaCents, 0)).toBe(b.deltaCents)
    expect(b.deltaCents).toBe(byId('2026-07').statedCents - byId('2026-06').statedCents)
    const sizes = b.steps.map((s) => Math.abs(s.deltaCents))
    expect(sizes).toEqual([...sizes].sort((x, y) => y - x))
  })
})
