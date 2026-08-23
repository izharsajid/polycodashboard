import { describe, expect, it } from 'vitest'
import { dateProse, dateTable, money, moneyShort, moneyWhole } from '../format'

describe('money on screen', () => {
  it('carries the symbol, always', () => {
    expect(money(5771014.86)).toBe('$5,771,014.86')
    expect(moneyWhole(5771015)).toBe('$5,771,015')
  })

  it('puts a negative in parentheses rather than using a minus', () => {
    // A minus sign is easy to miss on a dense page; parentheses are what a
    // finance reader expects.
    expect(money(-496489)).toBe('($496,489.00)')
    expect(moneyWhole(-1410206)).toBe('($1,410,206)')
  })

  it('writes zero as a figure, never a dash', () => {
    expect(money(0)).toBe('$0.00')
    expect(moneyWhole(0)).toBe('$0')
  })

  it('keeps the same decimals down a column', () => {
    expect([money(1), money(1000), money(1000000)]).toEqual([
      '$1.00', '$1,000.00', '$1,000,000.00',
    ])
  })

  it('abbreviates only where a tile needs it', () => {
    expect(moneyShort(5771014.86)).toBe('$5.77m')
    expect(moneyShort(1410206.34)).toBe('$1.41m')
    expect(moneyShort(-25799)).toBe('($26k)')
  })
})

describe('dates', () => {
  it('uses one format in prose and one in tables, never numeric', () => {
    expect(dateProse('2026-07-28')).toBe('28 July 2026')
    expect(dateTable('2026-07-28')).toBe('28 Jul 2026')
    expect(dateProse(null)).toBe('')
  })
})
