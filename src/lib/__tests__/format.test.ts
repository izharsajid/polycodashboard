import { describe, expect, it } from 'vitest'
import { whenLocal } from '../format'

describe('showing a timestamp', () => {
  it('says so when there is nothing to show', () => {
    // lastLoginAt is null for anyone who has been invited but has not signed in.
    expect(whenLocal(null)).toBe('Not yet')
  })

  it('does not throw on a value it cannot read', () => {
    expect(whenLocal('not a date')).toBe('Not known')
  })

  it('names the timezone, because this is read in two of them', () => {
    const shown = whenLocal('2026-08-22T09:00:00.000Z')
    expect(shown).toMatch(/2026/)
    expect(shown).toMatch(/GMT|UTC|BST|[+-]\d/)
  })
})
