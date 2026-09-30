import { beforeEach, describe, expect, it } from 'vitest'
import { STORES } from '../config'
import { consumeToken, issueToken, readToken, revokeTokensFor } from '../invitations'
import { kv, useMemoryStores } from '../kv'

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR
const START = new Date('2026-08-22T09:00:00.000Z')
const after = (ms: number) => new Date(START.getTime() + ms)

const invite = {
  email: 'samuel.story-taylor@polycohealthline.com',
  role: 'member',
  purpose: 'invitation',
} as const

beforeEach(() => {
  useMemoryStores()
})

describe('invitations', () => {
  it('issues a token that reads back to the invited address', async () => {
    const { token, invitation } = await issueToken(invite, START)
    const result = await readToken(token, 'invitation', after(HOUR))

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.invitation.email).toBe('samuel.story-taylor@polycohealthline.com')
      expect(result.invitation.role).toBe('member')
    }
    expect(invitation.consumedAt).toBeNull()
  })

  it('stores the hash and never the token in the link', async () => {
    const { token } = await issueToken(invite, START)
    const store = kv(STORES.invitations)
    const keys = await store.keys()

    expect(keys).toHaveLength(1)
    expect(keys[0]).not.toBe(token)
    expect(JSON.stringify(await store.get(keys[0]))).not.toContain(token)
  })

  it('lives 7 days, and not a millisecond more', async () => {
    const { token } = await issueToken(invite, START)
    expect((await readToken(token, 'invitation', after(7 * DAY - 1))).ok).toBe(true)

    const stale = await readToken(token, 'invitation', after(7 * DAY))
    expect(stale).toEqual({ ok: false, reason: 'expired' })
  })

  it('gives a password reset one hour', async () => {
    const { token } = await issueToken({ ...invite, purpose: 'reset' }, START)
    expect((await readToken(token, 'reset', after(HOUR - 1))).ok).toBe(true)
    expect(await readToken(token, 'reset', after(HOUR))).toEqual({ ok: false, reason: 'expired' })
  })

  it('is consumed once and cannot be replayed', async () => {
    const { token } = await issueToken(invite, START)

    const first = await consumeToken(token, 'invitation', after(HOUR))
    expect(first.ok).toBe(true)

    const replay = await consumeToken(token, 'invitation', after(2 * HOUR))
    expect(replay).toEqual({ ok: false, reason: 'consumed' })
    expect(await readToken(token, 'invitation', after(2 * HOUR))).toEqual({
      ok: false,
      reason: 'consumed',
    })
  })

  it('lets exactly one of two simultaneous uses through', async () => {
    const { token } = await issueToken(invite, START)
    const both = await Promise.all([
      consumeToken(token, 'invitation', after(HOUR)),
      consumeToken(token, 'invitation', after(HOUR)),
    ])
    expect(both.filter((r) => r.ok)).toHaveLength(1)
  })

  it('will not consume an expired token', async () => {
    const { token } = await issueToken(invite, START)
    expect(await consumeToken(token, 'invitation', after(8 * DAY))).toEqual({
      ok: false,
      reason: 'expired',
    })
  })

  it('does not admit that a token exists when it is the wrong kind', async () => {
    const { token } = await issueToken({ ...invite, purpose: 'reset' }, START)
    expect(await readToken(token, 'invitation', after(HOUR))).toEqual({
      ok: false,
      reason: 'not_found',
    })
  })

  it('treats an unknown or absent token as not found', async () => {
    expect(await readToken('nobody-issued-this', 'invitation', START)).toEqual({
      ok: false,
      reason: 'not_found',
    })
    expect(await consumeToken(null, 'invitation', START)).toEqual({
      ok: false,
      reason: 'not_found',
    })
  })

  it('kills the outstanding tokens for one address when a new one is issued', async () => {
    const first = await issueToken(invite, START)
    const other = await issueToken({ ...invite, email: 'andy.blewett@polycohealthline.com' }, START)
    const reset = await issueToken({ ...invite, purpose: 'reset' }, START)

    expect(await revokeTokensFor(invite.email, 'invitation')).toBe(1)

    expect((await readToken(first.token, 'invitation', after(HOUR))).ok).toBe(false)
    expect((await readToken(other.token, 'invitation', after(HOUR))).ok).toBe(true)
    expect((await readToken(reset.token, 'reset', after(1))).ok).toBe(true)
  })
})
