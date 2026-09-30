import { beforeEach, describe, expect, it } from 'vitest'
import login from '../../functions/auth-login.mts'
import logout from '../../functions/auth-logout.mts'
import me from '../../functions/auth-me.mts'
import changePassword from '../../functions/auth-password.mts'
import { listAudit } from '../audit'
import { useMemoryStores } from '../kv'
import { getUserByEmail, saveUser } from '../users'
import { cookieFrom, ctx, get, post, seedUser, signedIn } from './helpers'

const PASSWORD = 'brackish tundra ledger'
const IZHAR = 'izhar@ecofibre.bh'

beforeEach(() => {
  useMemoryStores()
})

const signIn = (email = IZHAR, password = PASSWORD) =>
  login(post('/api/auth/login', { email, password }), ctx())

describe('POST /api/auth/login', () => {
  it('signs in an active user and sets a session cookie', async () => {
    await seedUser({ email: IZHAR, password: PASSWORD, name: 'Izhar Sajid', role: 'admin' })
    const res = await signIn()

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.user.email).toBe(IZHAR)
    expect(body.user.role).toBe('admin')

    const cookie = res.headers.get('set-cookie') ?? ''
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('Secure')
    expect(cookie).toContain('SameSite=Strict')
  })

  it('never puts the password hash in the response', async () => {
    await seedUser({ email: IZHAR, password: PASSWORD })
    const body = await (await signIn()).text()

    expect(body).not.toContain('argon2')
    expect(body).not.toContain('passwordHash')
    expect(body).not.toContain(PASSWORD)
  })

  it('accepts the address in any casing', async () => {
    await seedUser({ email: IZHAR, password: PASSWORD })
    expect((await signIn('IZHAR@EcoFibre.BH')).status).toBe(200)
  })

  it('answers a wrong password and an unknown address identically', async () => {
    await seedUser({ email: IZHAR, password: PASSWORD })

    const wrong = await signIn(IZHAR, 'not the right password')
    const unknown = await signIn('nobody@ecofibre.bh', PASSWORD)

    expect(wrong.status).toBe(401)
    expect(unknown.status).toBe(401)
    expect(await wrong.text()).toBe(await unknown.text())
  })

  it('gives an invited account with no password the same answer', async () => {
    await seedUser({ email: 'hamza@ecofibre.bh', name: 'Hamza Sajid', role: 'admin' })
    const invited = await signIn('hamza@ecofibre.bh', PASSWORD)
    const unknown = await signIn('nobody@ecofibre.bh', PASSWORD)

    expect(invited.status).toBe(401)
    expect(await invited.text()).toBe(await unknown.text())
  })

  it('refuses a deactivated account holding the right password', async () => {
    await seedUser({ email: IZHAR, password: PASSWORD, status: 'deactivated' })
    expect((await signIn()).status).toBe(401)
  })

  it('refuses a locked account', async () => {
    const user = await seedUser({ email: IZHAR, password: PASSWORD })
    const locked = new Date(Date.now() + 15 * 60 * 1000).toISOString()
    await saveUser({ ...user, lockedUntil: locked })

    expect((await signIn()).status).toBe(401)
    const [entry] = await listAudit({ action: 'sign_in_failed' })
    expect(entry.detail).toMatch(/^account locked until /)
  })

  it('counts failures and clears the count on a good sign-in', async () => {
    await seedUser({ email: IZHAR, password: PASSWORD })

    await signIn(IZHAR, 'wrong once')
    await signIn(IZHAR, 'wrong twice')
    expect((await getUserByEmail(IZHAR))?.failedAttempts).toBe(2)

    await signIn()
    const user = await getUserByEmail(IZHAR)
    expect(user?.failedAttempts).toBe(0)
    expect(user?.lastLoginAt).not.toBeNull()
  })

  it('refuses a malformed body and the wrong method', async () => {
    expect((await login(post('/api/auth/login', { email: 'nope' }), ctx())).status).toBe(400)
    expect((await login(post('/api/auth/login', {}), ctx())).status).toBe(400)
    expect((await login(get('/api/auth/login'), ctx())).status).toBe(405)
  })

  it('records the sign-in, and the failures, without the secret', async () => {
    await seedUser({ email: IZHAR, password: PASSWORD })
    await signIn(IZHAR, 'wrong password here')
    const res = await signIn()

    const entries = await listAudit()
    expect(entries.map((e) => e.action)).toEqual(['sign_in', 'sign_in_failed'])
    expect(entries[0].actorEmail).toBe(IZHAR)
    expect(entries[0].ip).toBe('203.0.113.7')

    const written = JSON.stringify(entries)
    expect(written).not.toContain(PASSWORD)
    expect(written).not.toContain(cookieFrom(res).split('=')[1])
  })
})

describe('GET /api/auth/me', () => {
  it('refuses without a session and answers with one', async () => {
    await seedUser({ email: IZHAR, password: PASSWORD, name: 'Izhar Sajid', role: 'admin' })
    expect((await me(get('/api/auth/me'))).status).toBe(401)

    const res = await me(get('/api/auth/me', signedIn(await signIn())))
    expect(res.status).toBe(200)
    expect((await res.json()).user.name).toBe('Izhar Sajid')
  })

  it('refuses a made-up cookie', async () => {
    const headers = { cookie: '__Host-ef_session=not-a-real-session' }
    expect((await me(get('/api/auth/me', headers))).status).toBe(401)
  })

  it('stops working the moment the account is deactivated', async () => {
    const user = await seedUser({ email: IZHAR, password: PASSWORD })
    const headers = signedIn(await signIn())
    expect((await me(get('/api/auth/me', headers))).status).toBe(200)

    await saveUser({ ...(await getUserByEmail(IZHAR))!, status: 'deactivated' })
    expect((await me(get('/api/auth/me', headers))).status).toBe(401)
    expect(user.status).toBe('active')
  })
})

describe('POST /api/auth/logout', () => {
  it('ends the session and clears the cookie', async () => {
    await seedUser({ email: IZHAR, password: PASSWORD })
    const headers = signedIn(await signIn())

    const res = await logout(post('/api/auth/logout', {}, headers), ctx())
    expect(res.status).toBe(200)
    expect(res.headers.get('set-cookie')).toContain('Max-Age=0')

    expect((await me(get('/api/auth/me', headers))).status).toBe(401)
    expect((await listAudit({ action: 'sign_out' }))[0].actorEmail).toBe(IZHAR)
  })

  it('is content to sign out somebody who is already signed out', async () => {
    const res = await logout(post('/api/auth/logout', {}), ctx())
    expect(res.status).toBe(200)
    expect(await listAudit({ action: 'sign_out' })).toHaveLength(0)
  })
})

describe('POST /api/auth/password', () => {
  const change = (body: unknown, headers: Record<string, string> = {}) =>
    changePassword(post('/api/auth/password', body, headers), ctx())

  it('refuses without a session', async () => {
    expect((await change({ currentPassword: PASSWORD, newPassword: 'a whole new phrase' })).status).toBe(401)
  })

  it('refuses the wrong current password, and leaves the old one working', async () => {
    await seedUser({ email: IZHAR, password: PASSWORD })
    const headers = signedIn(await signIn())

    const res = await change({ currentPassword: 'not it at all', newPassword: 'a whole new phrase' }, headers)
    expect(res.status).toBe(400)
    expect((await signIn()).status).toBe(200)
    expect((await listAudit({ action: 'password_changed' }))[0].result).toBe('failure')
  })

  it('refuses a new password the policy will not take', async () => {
    await seedUser({ email: IZHAR, password: PASSWORD })
    const headers = signedIn(await signIn())

    const res = await change({ currentPassword: PASSWORD, newPassword: 'password1234' }, headers)
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/well known/)
    expect((await signIn()).status).toBe(200)
  })

  it('changes it, and the old password stops working', async () => {
    await seedUser({ email: IZHAR, password: PASSWORD })
    const headers = signedIn(await signIn())

    expect((await change({ currentPassword: PASSWORD, newPassword: 'a whole new phrase' }, headers)).status).toBe(200)
    expect((await signIn()).status).toBe(401)
    expect((await signIn(IZHAR, 'a whole new phrase')).status).toBe(200)
  })

  it('signs out every other session and keeps this one', async () => {
    await seedUser({ email: IZHAR, password: PASSWORD })
    const laptop = signedIn(await signIn())
    const phone = signedIn(await signIn())

    const res = await change({ currentPassword: PASSWORD, newPassword: 'a whole new phrase' }, phone)
    expect((await res.json()).otherSessionsSignedOut).toBe(1)

    expect((await me(get('/api/auth/me', phone))).status).toBe(200)
    expect((await me(get('/api/auth/me', laptop))).status).toBe(401)
  })
})
