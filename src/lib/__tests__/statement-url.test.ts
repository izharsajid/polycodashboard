import { describe, expect, it } from 'vitest'
import { DEFAULT_STATE, readStatementUrl, resolvePreset, writeStatementUrl } from '../statement-url'

describe('carrying the view in the URL', () => {
  it('opens a bare link on the defaults', () => {
    expect(readStatementUrl('')).toEqual(DEFAULT_STATE)
  })

  it('round-trips a chosen view', () => {
    const state = {
      from: '2026-01-01',
      to: '2026-03-31',
      columns: ['date', 'type', 'reference', 'received', 'delivered', 'balance'] as const,
      sort: 'reference' as const,
      direction: 'desc' as const,
    }
    expect(readStatementUrl(writeStatementUrl({ ...state, columns: [...state.columns] }))).toEqual({
      ...state,
      columns: [...state.columns],
    })
  })

  it('leaves an unmodified view with a clean URL', () => {
    expect(writeStatementUrl(DEFAULT_STATE)).toBe('')
  })

  it('ignores a date that is not a date rather than throwing', () => {
    const state = readStatementUrl('?from=yesterday&to=2026-03-31')
    expect(state.from).toBeNull()
    expect(state.to).toBe('2026-03-31')
  })

  it('drops a column it does not recognise, so a stale link still opens', () => {
    const state = readStatementUrl('?cols=date,invented,balance')
    expect(state.columns).toEqual(['date', 'balance'])
  })

  it('puts the running balance back if a link tries to drop it', () => {
    // Never removable, per section 3. A hand-edited link cannot take it away.
    expect(readStatementUrl('?cols=date,reference').columns).toContain('balance')
  })

  it('falls back to sorting by date when the sort key is unknown', () => {
    expect(readStatementUrl('?sort=nonsense').sort).toBe('date')
    expect(readStatementUrl('?dir=sideways').direction).toBe('asc')
  })
})

describe('the date presets', () => {
  const today = new Date('2026-08-22T00:00:00Z')

  it('resolves this month to its first and last day', () => {
    expect(resolvePreset('this-month', today)).toEqual({ from: '2026-08-01', to: '2026-08-31' })
  })

  it('resolves last month', () => {
    expect(resolvePreset('last-month', today)).toEqual({ from: '2026-07-01', to: '2026-07-31' })
  })

  it('resolves the last three months inclusive of this one', () => {
    expect(resolvePreset('last-three', today)).toEqual({ from: '2026-06-01', to: '2026-08-31' })
  })

  it('resolves this year', () => {
    expect(resolvePreset('this-year', today)).toEqual({ from: '2026-01-01', to: '2026-12-31' })
  })

  it('resolves all to no range at all', () => {
    expect(resolvePreset('all', today)).toEqual({ from: null, to: null })
  })

  it('crosses a year boundary without inventing a month', () => {
    const january = new Date('2026-01-15T00:00:00Z')
    expect(resolvePreset('last-month', january)).toEqual({ from: '2025-12-01', to: '2025-12-31' })
    expect(resolvePreset('last-three', january)).toEqual({ from: '2025-11-01', to: '2026-01-31' })
  })
})
