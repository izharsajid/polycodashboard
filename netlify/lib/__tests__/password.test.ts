import { describe, expect, it } from 'vitest'
import { checkPassword, hashPassword, verifyPassword } from '../password'

describe('Argon2id hashing', () => {
  it('produces a hash that verifies and does not contain the password', async () => {
    const hash = await hashPassword('brackish tundra ledger')
    expect(hash.startsWith('$argon2id$')).toBe(true)
    expect(hash).not.toContain('brackish')
    expect(await verifyPassword('brackish tundra ledger', hash)).toBe(true)
    expect(await verifyPassword('brackish tundra ledgeR', hash)).toBe(false)
  })

  it('salts, so one password never hashes to the same string twice', async () => {
    const a = await hashPassword('the same words twice over')
    const b = await hashPassword('the same words twice over')
    expect(a).not.toBe(b)
    expect(await verifyPassword('the same words twice over', a)).toBe(true)
    expect(await verifyPassword('the same words twice over', b)).toBe(true)
  })

  it('carries the configured cost parameters, so they can be raised later', async () => {
    expect(await hashPassword('carry the parameters')).toContain('$m=19456,t=2,p=1$')
  })

  it('reads a missing or corrupt hash as a failed verification, not an error', async () => {
    expect(await verifyPassword('anything at all', null)).toBe(false)
    expect(await verifyPassword('anything at all', '')).toBe(false)
    expect(await verifyPassword('anything at all', 'not-a-hash')).toBe(false)
  })
})

describe('password policy', () => {
  it('accepts a long ordinary passphrase', () => {
    expect(checkPassword('brackish tundra ledger')).toEqual({ ok: true })
  })

  it('imposes no composition rules', () => {
    // All lower case, no digit, no symbol. AUTH-SPEC section 4: length beats complexity.
    expect(checkPassword('all lower case words here')).toEqual({ ok: true })
  })

  it('refuses anything under twelve characters', () => {
    expect(checkPassword('short').ok).toBe(false)
    expect(checkPassword('elevenchars').ok).toBe(false)
    expect(checkPassword('  padded out  ').ok).toBe(false)
  })

  it('refuses a common password wearing padding', () => {
    expect(checkPassword('password1234').ok).toBe(false)
    expect(checkPassword('P@ssw0rd!!!!').ok).toBe(false)
    expect(checkPassword('qwertyuiop123').ok).toBe(false)
    expect(checkPassword('letmein202626').ok).toBe(false)
  })

  it('refuses a straight run and a single character repeated', () => {
    expect(checkPassword('abcdefghijkl').ok).toBe(false)
    expect(checkPassword('aaaaaaaaaaaaaa').ok).toBe(false)
    expect(checkPassword('123456789012').ok).toBe(false)
  })

  it('refuses the company name and the person choosing it', () => {
    expect(checkPassword('ecofibre-bahrain-2026').ok).toBe(false)
    expect(checkPassword('polyco healthline ltd').ok).toBe(false)
    expect(checkPassword('izhar is the admin here', { email: 'izhar@ecofibre.bh' }).ok).toBe(false)
    expect(checkPassword('story-taylor sets this', { name: 'Samuel Story-Taylor' }).ok).toBe(false)
  })

  it('says why, because the person choosing has to be able to fix it', () => {
    const verdict = checkPassword('short')
    expect(verdict.ok).toBe(false)
    if (!verdict.ok) expect(verdict.reason).toMatch(/12 characters/)
  })
})
