import { beforeEach, describe, expect, it } from 'vitest'
import { SESSION_COOKIE, STORES } from '../config'
import { kv, useMemoryStores } from '../kv'
import {
  clearedSessionCookie,
  createSession,
  destroySession,
  readSessionCookie,
  resolveSession,
  revokeUserSessions,
  sessionCookie,
} from '../sessions'

const HOUR = 60 * 60 * 1000
const START = new Date('2026-08-22T09:00:00.000Z')
const after = (ms: number) => new Date(START.getTime() + ms)

beforeEach(() => {
  useMemoryStores()
})

describe('sessions', () => {
  it('resolves the cookie it just issued', async () => {
    const { token } = await createSession({ userId: 'u-izhar', ip: '1.2.3.4' }, START)
    const session = await resolveSession(token, after(60 * 1000))
    expect(session?.userId).toBe('u-izhar')
    expect(session?.ip).toBe('1.2.3.4')
  })

  it('stores the hash and never the cookie value itself', async () => {
    const { token } = await createSession({ userId: 'u-izhar' }, START)
    const store = kv(STORES.sessions)
    const keys = await store.keys()

    expect(keys).toHaveLength(1)
    expect(keys[0]).not.toBe(token)
    expect(JSON.stringify(await store.get(keys[0]))).not.toContain(token)
  })

  it('refuses an unknown token without saying why', async () => {
    expect(await resolveSession('a token nobody issued', START)).toBeNull()
    expect(await resolveSession(null, START)).toBeNull()
    expect(await resolveSession('', START)).toBeNull()
  })

  it('expires after 12 hours idle', async () => {
    const { token } = await createSession({ userId: 'u-izhar' }, START)
    expect(await resolveSession(token, after(11.9 * HOUR))).not.toBeNull()

    const { token: second } = await createSession({ userId: 'u-izhar' }, START)
    expect(await resolveSession(second, after(12 * HOUR))).toBeNull()
  })

  it('pushes the idle limit forward on use', async () => {
    const { token } = await createSession({ userId: 'u-izhar' }, START)
    expect(await resolveSession(token, after(11 * HOUR))).not.toBeNull()
    // Idle now runs from hour 11, not from creation.
    expect(await resolveSession(token, after(22 * HOUR))).not.toBeNull()
    expect(await resolveSession(token, after(35 * HOUR))).toBeNull()
  })

  it('expires 7 days after it was created, however much it is used', async () => {
    const { token } = await createSession({ userId: 'u-izhar' }, START)
    for (let hours = 6; hours <= 162; hours += 6) {
      expect(await resolveSession(token, after(hours * HOUR))).not.toBeNull()
    }
    expect(await resolveSession(token, after(168 * HOUR))).toBeNull()
  })

  it('deletes an expired session rather than leaving it lying about', async () => {
    const { token } = await createSession({ userId: 'u-izhar' }, START)
    await resolveSession(token, after(13 * HOUR))
    expect(await kv(STORES.sessions).keys()).toHaveLength(0)
  })

  it('signs out', async () => {
    const { token } = await createSession({ userId: 'u-izhar' }, START)
    await destroySession(token)
    expect(await resolveSession(token, after(60 * 1000))).toBeNull()
  })

  it('revokes every other session for one user and leaves everyone else alone', async () => {
    const current = await createSession({ userId: 'u-izhar' }, START)
    const laptop = await createSession({ userId: 'u-izhar' }, START)
    const phone = await createSession({ userId: 'u-izhar' }, START)
    const hamza = await createSession({ userId: 'u-hamza' }, START)

    const revoked = await revokeUserSessions('u-izhar', current.token)
    expect(revoked).toBe(2)

    const at = after(60 * 1000)
    expect(await resolveSession(current.token, at)).not.toBeNull()
    expect(await resolveSession(laptop.token, at)).toBeNull()
    expect(await resolveSession(phone.token, at)).toBeNull()
    expect(await resolveSession(hamza.token, at)).not.toBeNull()
  })

  it('revokes all of them when no session is kept', async () => {
    const a = await createSession({ userId: 'u-izhar' }, START)
    const b = await createSession({ userId: 'u-izhar' }, START)
    expect(await revokeUserSessions('u-izhar')).toBe(2)
    expect(await resolveSession(a.token, after(60 * 1000))).toBeNull()
    expect(await resolveSession(b.token, after(60 * 1000))).toBeNull()
  })
})

describe('the session cookie', () => {
  it('is HttpOnly, Secure, SameSite=Strict and host bound', () => {
    const cookie = sessionCookie('a-token')
    expect(cookie.startsWith(`${SESSION_COOKIE}=a-token;`)).toBe(true)
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('Secure')
    expect(cookie).toContain('SameSite=Strict')
    expect(cookie).toContain('Path=/')
    expect(SESSION_COOKIE.startsWith('__Host-')).toBe(true)
  })

  it('clears by expiring, with the same attributes', () => {
    const cookie = clearedSessionCookie()
    expect(cookie).toContain('Max-Age=0')
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('Secure')
  })

  it('reads its own value out of a header carrying other cookies', () => {
    const header = `nf_ab=1; ${SESSION_COOKIE}=the-token; other=2`
    expect(readSessionCookie(header)).toBe('the-token')
    expect(readSessionCookie('nf_ab=1; other=2')).toBeNull()
    expect(readSessionCookie(`${SESSION_COOKIE}=`)).toBeNull()
    expect(readSessionCookie(null)).toBeNull()
  })
})
