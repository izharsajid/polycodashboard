/**
 * The engine against the statements as issued.
 *
 * These live outside /src on purpose: they assert business figures, and /src may
 * not carry a business number as a literal.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildModel } from '../src/engine/funds'
import { FundsRequested } from '../src/engine/schema'
import { amount, usd } from '../src/lib/format'

const data = FundsRequested.parse(
  JSON.parse(readFileSync(new URL('../data/funds-requested.json', import.meta.url), 'utf8')),
)
const model = buildModel(data, '2026-10-01')
const byId = (id: string) => model.statements.find((s) => s.id === id)!

describe('the record', () => {
  it('holds sixteen statements and 167 lines', () => {
    expect(model.statements).toHaveLength(16)
    expect(model.statements.flatMap((s) => s.lines)).toHaveLength(167)
  })

  it('foots every statement, lines less income, to its own stated total, to the cent', () => {
    for (const raw of data.statements) {
      const lines = raw.lines.reduce((sum, l) => sum + Math.round(l.amount * 100), 0)
      const income = raw.income.reduce((sum, l) => sum + Math.round(l.amount * 100), 0)
      expect(lines - income, raw.id).toBe(Math.round(raw.stated_total * 100))
    }
  })

  it('runs to 24 October 2026', () => {
    expect(model.recordEnd).toBe('2026-10-24')
  })
})

describe('what counts as a request', () => {
  it('totals the 15 requests to US$3,175,832.63', () => {
    expect(model.requestCount).toBe(15)
    expect(model.requestedCents).toBe(317_583_263)
    expect(usd(model.requestedCents)).toBe('US$3,175,832.63')
  })

  it('keeps October 2025 out, because it records actuals, not a request', () => {
    const october = byId('2025-10')
    expect(october.kind).toBe('actuals')
    expect(october.isRequest).toBe(false)
    expect(model.excluded.map((s) => s.id)).toEqual(['2025-10'])
    const everything = model.statements.reduce((sum, s) => sum + s.statedCents, 0)
    expect(everything).toBe(339_457_563)
  })

  it('counts August 2025, a request carrying actuals, and November 2025 in full', () => {
    expect(byId('2025-08').isRequest).toBe(true)
    expect(byId('2025-11').isRequest).toBe(true)
  })

  it('averages US$211,722 in the headline', () => {
    expect(model.averageCents).toBe(21_172_218)
    expect(model.headline).toBe(
      '15 funding requests, June 2025 to September 2026, averaging US$211,722 a month.',
    )
  })
})

describe('the two newest statements', () => {
  it('asks US$128,975.27 for 15 August to 15 September 2026, with the held and paid lines at zero', () => {
    const august = byId('2026-08')
    expect(august.statedCents).toBe(12_897_527)
    expect(august.lines.filter((l) => l.cents === 0)).toHaveLength(5)
  })

  it('sets the Zultec income against September 2026 costs', () => {
    const september = byId('2026-09')
    expect(september.costsCents).toBe(22_093_986)
    expect(september.incomeCents).toBe(1_525_000)
    expect(september.statedCents).toBe(20_568_986)
  })
})

describe('credits', () => {
  it('shows the customs duty refund as a credit, never a minus sign', () => {
    const credit = byId('2026-07').lines.find((l) => l.cents < 0)!
    expect(credit.cents).toBe(-1_911_000)
    expect(amount(credit.cents)).toBe('(19,110.00)')
  })
})
