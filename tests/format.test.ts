import { describe, expect, it } from 'vitest'
import { amount, range, thousands, usd, usdWhole } from '../src/lib/format'

describe('money', () => {
  it('puts a credit in parentheses, never a minus sign', () => {
    expect(amount(-1_911_000)).toBe('(19,110.00)')
    expect(usd(-1_911_000)).toBe('(US$19,110.00)')
  })

  it('shows zero as a figure, not a dash', () => {
    expect(amount(0)).toBe('0.00')
  })

  it('keeps cents where the source carries them', () => {
    expect(amount(24_310_555)).toBe('243,105.55')
  })

  it('rounds whole dollars half away from zero', () => {
    expect(usdWhole(21_855_150)).toBe('US$218,552')
    expect(usdWhole(21_855_135)).toBe('US$218,551')
  })

  it('writes axis ticks in thousands', () => {
    expect(thousands(25_000_000)).toBe('250')
    expect(thousands(-2_500_000)).toBe('(25)')
  })
})

describe('date ranges', () => {
  it('writes a range the short way', () => {
    expect(range('2025-06-01', '2025-06-30')).toBe('1 to 30 Jun 2025')
    expect(range('2026-02-05', '2026-03-05')).toBe('5 Feb to 5 Mar 2026')
    expect(range('2025-12-01', '2026-01-04')).toBe('1 Dec 2025 to 4 Jan 2026')
    expect(range('2026-10-01', '2026-10-01')).toBe('1 Oct 2026')
  })
})
