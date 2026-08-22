import { describe, expect, it } from 'vitest'
import { isPublic, loginPathFor, nextFrom, safeNext, tokenFromHash } from '../router'

describe('which pages need a session', () => {
  it('lets the sign-in and link pages through', () => {
    expect(isPublic('/login')).toBe(true)
    expect(isPublic('/forgot')).toBe(true)
    expect(isPublic('/invite')).toBe(true)
    expect(isPublic('/reset')).toBe(true)
  })

  it('guards everything else, including the pages not built yet', () => {
    expect(isPublic('/')).toBe(false)
    expect(isPublic('/account')).toBe(false)
    expect(isPublic('/admin')).toBe(false)
    // No prefix matching. /invited is not an invitation page, and there is no
    // longer any such thing as /invite/<token>.
    expect(isPublic('/invited')).toBe(false)
    expect(isPublic('/invite/abc')).toBe(false)
    expect(isPublic('/resets')).toBe(false)
  })
})

describe('reading the token out of a link', () => {
  it('takes it from the fragment, where the server never sees it', () => {
    expect(tokenFromHash('#abc-123')).toBe('abc-123')
    expect(tokenFromHash('abc-123')).toBe('abc-123')
  })

  it('returns nothing when there is no fragment', () => {
    expect(tokenFromHash('')).toBeNull()
    expect(tokenFromHash('#')).toBeNull()
  })
})

describe('being sent to sign in and coming back', () => {
  it('remembers the page that was asked for', () => {
    expect(loginPathFor('/admin')).toBe('/login?next=%2Fadmin')
    expect(nextFrom('?next=%2Fadmin')).toBe('/admin')
  })

  it('does not bother remembering the front page', () => {
    expect(loginPathFor('/')).toBe('/login')
    expect(loginPathFor('/login')).toBe('/login')
  })

  it('returns to the front page when there is nothing to return to', () => {
    expect(nextFrom('')).toBe('/')
    expect(safeNext(null)).toBe('/')
    expect(safeNext('')).toBe('/')
  })

  it('refuses to be turned into an open redirect', () => {
    // Each of these is another host to a browser, not a page on this site.
    expect(safeNext('//evil.example')).toBe('/')
    expect(safeNext('https://evil.example')).toBe('/')
    expect(safeNext('/\\evil.example')).toBe('/')
    expect(safeNext('\\\\evil.example')).toBe('/')
    expect(safeNext('javascript:alert(1)')).toBe('/')
    expect(safeNext('/\tevil')).toBe('/')
    expect(safeNext('/\nevil')).toBe('/')
    expect(nextFrom('?next=%2F%2Fevil.example')).toBe('/')
  })

  it('keeps a real path, query and all', () => {
    expect(safeNext('/admin')).toBe('/admin')
    expect(safeNext('/admin?filter=sign_in')).toBe('/admin?filter=sign_in')
  })
})
