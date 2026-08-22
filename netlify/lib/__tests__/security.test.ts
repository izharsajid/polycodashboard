import { beforeEach, describe, expect, it } from 'vitest'
import auditHandler from '../../functions/audit.mts'
import forgot from '../../functions/auth-forgot.mts'
import login from '../../functions/auth-login.mts'
import reset from '../../functions/auth-reset.mts'
import dataHandler from '../../functions/data.mts'
import accept from '../../functions/invitations-accept.mts'
import validate from '../../functions/invitations-validate.mts'
import invite from '../../functions/users-invite.mts'
import listHandler from '../../functions/users-list.mts'
import update from '../../functions/users-update.mts'
import { listAudit } from '../audit'
import { LOCKOUT_THRESHOLD, RATE_LIMITS } from '../config'
import { type Delivery, onDeliver } from '../delivery'
import { issueToken } from '../invitations'
import { useMemoryStores } from '../kv'
import { getUserByEmail } from '../users'
import { ctx, get, post, seedUser, signedIn } from './helpers'

/**
 * AUTH-SPEC section 9's list, one describe each. Every one has to fail correctly
 * *and* appear in the audit log, so each case asserts both. A refusal nobody can
 * see afterwards is half a control.
 */
const PASSWORD = 'brackish tundra ledger'
const IZHAR = 'izhar@ecofibre.bh'
const SAMUEL = 'samuel.story-taylor@polycohealthline.com'

let sent: Delivery[] = []

beforeEach(() => {
  useMemoryStores()
  sent = []
  onDeliver(async (d) => {
    sent.push(d)
  })
})

const data = (req: Request) => dataHandler(req, ctx())
const list = (req: Request) => listHandler(req, ctx())
const audit = (req: Request) => auditHandler(req, ctx())
const signIn = (email: string, password = PASSWORD) =>
  login(post('/api/auth/login', { email, password }), ctx())

const withId = (id: string) =>
  ({ params: { id }, ip: '203.0.113.7' }) as unknown as Parameters<typeof update>[1]

const patch = (id: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(`https://dashboard.ecofibre.bh/api/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json', ...headers },
  })

describe('an unauthenticated request to a protected route', () => {
  it('is refused everywhere, and every refusal is recorded', async () => {
    const target = await seedUser({ email: SAMUEL, name: 'Samuel Story-Taylor' })

    expect((await data(get('/api/data'))).status).toBe(401)
    expect((await list(get('/api/users'))).status).toBe(401)
    expect((await audit(get('/api/audit'))).status).toBe(401)
    expect((await update(patch(target.id, { role: 'admin' }), withId(target.id))).status).toBe(401)

    const refusals = await listAudit({ action: 'access_refused' })
    expect(refusals).toHaveLength(4)
    expect(refusals.map((r) => r.target).sort()).toEqual([
      '/api/audit',
      '/api/data',
      '/api/users',
      `/api/users/${target.id}`,
    ])
    expect(refusals.every((r) => r.result === 'failure')).toBe(true)
    expect(refusals.every((r) => r.detail === 'no valid session')).toBe(true)
  })

  it('gives away nothing of what it is guarding', async () => {
    const body = await (await data(get('/api/data'))).text()
    expect(body).not.toMatch(/source_row|uncovered_advance|2466124/)
  })
})

describe('a member attempting an admin action', () => {
  async function member() {
    await seedUser({ email: IZHAR, password: PASSWORD, name: 'Izhar Sajid', role: 'admin' })
    await seedUser({ email: SAMUEL, password: PASSWORD, name: 'Samuel Story-Taylor' })
    return signedIn(await signIn(SAMUEL))
  }

  it('is refused by the server, not by a hidden link, and recorded with a name on it', async () => {
    const headers = await member()
    const admin = (await getUserByEmail(IZHAR))!

    expect((await audit(get('/api/audit', headers))).status).toBe(403)
    expect(
      (await update(patch(admin.id, { role: 'member' }, headers), withId(admin.id))).status,
    ).toBe(403)

    // Nothing changed.
    expect((await getUserByEmail(IZHAR))?.role).toBe('admin')

    const refusals = await listAudit({ action: 'access_refused' })
    expect(refusals).toHaveLength(2)
    expect(refusals.every((r) => r.actorEmail === SAMUEL)).toBe(true)
    expect(refusals.every((r) => r.detail === 'member asked for an administrator endpoint')).toBe(
      true,
    )
  })

  it('still lets them see the things a member is meant to see', async () => {
    const headers = await member()
    expect((await list(get('/api/users', headers))).status).toBe(200)
    expect((await data(get('/api/data', headers))).status).toBe(200)
  })
})

describe('an invitation to a disallowed domain', () => {
  it('is refused, nothing is created, and the refusal is recorded', async () => {
    await seedUser({ email: IZHAR, password: PASSWORD, name: 'Izhar Sajid', role: 'admin' })
    const headers = signedIn(await signIn(IZHAR))

    const res = await invite(
      post('/api/users/invite', { email: 'someone@gmail.com', name: 'Someone' }, headers),
      ctx(),
    )

    expect(res.status).toBe(403)
    expect(await getUserByEmail('someone@gmail.com')).toBeNull()
    expect(sent).toHaveLength(0)

    const [entry] = await listAudit({ action: 'invitation_refused_domain' })
    expect(entry.target).toBe('someone@gmail.com')
    expect(entry.actorEmail).toBe(IZHAR)
    expect(entry.detail).toBe('domain_not_permitted')
  })
})

describe('a consumed token replayed', () => {
  it('is refused the second time, and the replay is recorded', async () => {
    await seedUser({ email: IZHAR, password: PASSWORD, name: 'Izhar Sajid', role: 'admin' })
    const headers = signedIn(await signIn(IZHAR))
    await invite(post('/api/users/invite', { email: SAMUEL, name: 'Samuel Story-Taylor' }, headers), ctx())

    const token = sent[0].token
    const first = await accept(post('/api/invitations/accept', { token, password: 'a fresh arrangement' }), ctx())
    expect(first.status).toBe(200)

    const replay = await accept(
      post('/api/invitations/accept', { token, password: 'something else entirely' }),
      ctx(),
    )
    expect(replay.status).toBe(410)

    // The replay set nothing. The first password still stands.
    expect((await signIn(SAMUEL, 'a fresh arrangement')).status).toBe(200)
    expect((await signIn(SAMUEL, 'something else entirely')).status).toBe(401)

    const failures = (await listAudit({ action: 'invitation_accepted' })).filter(
      (e) => e.result === 'failure',
    )
    expect(failures).toHaveLength(1)
    expect(failures[0].detail).toMatch(/consumed|status is active/)
  })

  it('cannot be replayed through the validate endpoint either', async () => {
    const { token } = await issueToken({ email: SAMUEL, role: 'member', purpose: 'invitation' })
    await seedUser({ email: SAMUEL, name: 'Samuel Story-Taylor' })

    expect((await validate(post('/api/invitations/validate', { token }))).status).toBe(200)
    await accept(post('/api/invitations/accept', { token, password: 'a fresh arrangement' }), ctx())
    expect((await validate(post('/api/invitations/validate', { token }))).status).toBe(410)
  })
})

describe('an expired token', () => {
  const eightDaysAgo = () => new Date(Date.now() - 8 * 24 * 60 * 60 * 1000)
  const twoHoursAgo = () => new Date(Date.now() - 2 * 60 * 60 * 1000)

  it('is refused for an invitation, and recorded', async () => {
    await seedUser({ email: SAMUEL, name: 'Samuel Story-Taylor' })
    const { token } = await issueToken(
      { email: SAMUEL, role: 'member', purpose: 'invitation' },
      eightDaysAgo(),
    )

    const res = await accept(post('/api/invitations/accept', { token, password: 'a fresh arrangement' }), ctx())
    expect(res.status).toBe(410)
    expect((await getUserByEmail(SAMUEL))?.status).toBe('invited')

    const [entry] = await listAudit({ action: 'invitation_accepted' })
    expect(entry.result).toBe('failure')
    expect(entry.detail).toBe('invitation token expired')
  })

  it('is refused for a reset, and recorded', async () => {
    await seedUser({ email: IZHAR, password: PASSWORD, name: 'Izhar Sajid' })
    const { token } = await issueToken(
      { email: IZHAR, role: 'member', purpose: 'reset' },
      twoHoursAgo(),
    )

    const res = await reset(post('/api/auth/reset', { token, password: 'a fresh arrangement' }), ctx())
    expect(res.status).toBe(410)
    expect((await signIn(IZHAR)).status).toBe(200)

    const [entry] = await listAudit({ action: 'password_reset_completed' })
    expect(entry.result).toBe('failure')
    expect(entry.detail).toBe('reset token expired')
  })
})

describe('a locked account', () => {
  it('locks after ten consecutive failures and records the lock', async () => {
    await seedUser({ email: IZHAR, password: PASSWORD, name: 'Izhar Sajid' })

    for (let i = 0; i < LOCKOUT_THRESHOLD; i++) {
      expect((await signIn(IZHAR, `wrong guess number ${i}`)).status).toBe(401)
    }

    const user = await getUserByEmail(IZHAR)
    expect(user?.failedAttempts).toBe(LOCKOUT_THRESHOLD)
    expect(user?.lockedUntil).not.toBeNull()

    const [lock] = await listAudit({ action: 'account_locked' })
    expect(lock.actorEmail).toBe(IZHAR)
    expect(lock.detail).toMatch(/10 consecutive failures/)
  })

  it('refuses the right password while locked, and says nothing different', async () => {
    // The lock is set here rather than driven through ten failures, because ten
    // failures also exhausts the login rate limit and a 429 would answer first.
    // The test above already proves the ten failures set it.
    const user = await seedUser({ email: IZHAR, password: PASSWORD, name: 'Izhar Sajid' })
    const { saveUser } = await import('../users')
    await saveUser({
      ...user,
      failedAttempts: LOCKOUT_THRESHOLD,
      lockedUntil: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    })

    const locked = await signIn(IZHAR)
    const unknown = await signIn('nobody@ecofibre.bh')

    expect(locked.status).toBe(401)
    expect(await locked.text()).toBe(await unknown.text())

    const failures = await listAudit({ action: 'sign_in_failed' })
    expect(failures.some((f) => /^account locked until /.test(f.detail ?? ''))).toBe(true)
  })

  it('is refused by the rate limit at the same moment it is locked', async () => {
    // AUTH-SPEC sets both to ten, so they land together and reinforce each
    // other: the eleventh attempt is refused whichever control you look at.
    await seedUser({ email: IZHAR, password: PASSWORD, name: 'Izhar Sajid' })
    for (let i = 0; i < LOCKOUT_THRESHOLD; i++) await signIn(IZHAR, `wrong guess number ${i}`)

    expect((await getUserByEmail(IZHAR))?.lockedUntil).not.toBeNull()
    expect((await signIn(IZHAR)).status).toBe(429)
  })

  it('lifts the lock once it has run out, and records the unlock', async () => {
    const user = await seedUser({ email: IZHAR, password: PASSWORD, name: 'Izhar Sajid' })
    const { saveUser } = await import('../users')
    await saveUser({
      ...user,
      failedAttempts: LOCKOUT_THRESHOLD,
      lockedUntil: new Date(Date.now() - 1000).toISOString(),
    })

    expect((await signIn(IZHAR)).status).toBe(200)

    const after = await getUserByEmail(IZHAR)
    expect(after?.lockedUntil).toBeNull()
    expect(after?.failedAttempts).toBe(0)

    const [unlock] = await listAudit({ action: 'account_unlocked' })
    expect(unlock.detail).toBe('lock expired')
  })

  it('clears the count on a good sign-in, so the ten must be consecutive', async () => {
    await seedUser({ email: IZHAR, password: PASSWORD, name: 'Izhar Sajid' })

    for (let i = 0; i < LOCKOUT_THRESHOLD - 1; i++) await signIn(IZHAR, `wrong guess ${i}`)
    expect((await signIn(IZHAR)).status).toBe(200)
    expect((await getUserByEmail(IZHAR))?.failedAttempts).toBe(0)

    await signIn(IZHAR, 'wrong again')
    expect((await getUserByEmail(IZHAR))?.lockedUntil).toBeNull()
  })
})

describe('rate limits', () => {
  it('stops login attempts past the limit, and records the breach', async () => {
    await seedUser({ email: IZHAR, password: PASSWORD, name: 'Izhar Sajid' })

    for (let i = 0; i < RATE_LIMITS.login.limit; i++) {
      expect((await signIn(IZHAR, `guess ${i}`)).status).toBe(401)
    }

    const blocked = await signIn(IZHAR, 'one too many')
    expect(blocked.status).toBe(429)
    expect(Number(blocked.headers.get('retry-after'))).toBeGreaterThan(0)

    // Even the right password waits its turn.
    expect((await signIn(IZHAR)).status).toBe(429)

    const [breach] = await listAudit({ action: 'rate_limit_exceeded' })
    expect(breach.result).toBe('failure')
    expect(breach.detail).toMatch(/login attempts/)
  })

  it('stops reset requests past the limit without ever admitting who exists', async () => {
    await seedUser({ email: IZHAR, password: PASSWORD, name: 'Izhar Sajid' })

    for (let i = 0; i < RATE_LIMITS.forgot.limit; i++) {
      expect((await forgot(post('/api/auth/forgot', { email: IZHAR }), ctx())).status).toBe(200)
    }
    expect((await forgot(post('/api/auth/forgot', { email: IZHAR }), ctx())).status).toBe(429)

    // An address with no account behaves identically once it hits the limit.
    const unknown = 'nobody@ecofibre.bh'
    for (let i = 0; i < RATE_LIMITS.forgot.limit; i++) {
      await forgot(post('/api/auth/forgot', { email: unknown }), ctx())
    }
    expect((await forgot(post('/api/auth/forgot', { email: unknown }), ctx())).status).toBe(429)
  })

  it('stops one person sending more than a day of invitations', async () => {
    await seedUser({ email: IZHAR, password: PASSWORD, name: 'Izhar Sajid', role: 'admin' })
    const headers = signedIn(await signIn(IZHAR))

    for (let i = 0; i < RATE_LIMITS.invite.limit; i++) {
      const res = await invite(
        post('/api/users/invite', { email: `person${i}@ecofibre.bh`, name: `Person ${i}` }, headers),
        ctx(),
      )
      expect(res.status).toBe(201)
    }

    const blocked = await invite(
      post('/api/users/invite', { email: 'one.more@ecofibre.bh', name: 'One More' }, headers),
      ctx(),
    )
    expect(blocked.status).toBe(429)
    expect(await getUserByEmail('one.more@ecofibre.bh')).toBeNull()

    const [breach] = await listAudit({ action: 'rate_limit_exceeded' })
    expect(breach.actorEmail).toBe(IZHAR)
  })

  it('counts one account separately from another', async () => {
    await seedUser({ email: IZHAR, password: PASSWORD, name: 'Izhar Sajid' })
    await seedUser({ email: SAMUEL, password: PASSWORD, name: 'Samuel Story-Taylor' })

    // The by-IP limit is not in play here: ctx() gives every call the same
    // address, so exhausting one account must not exhaust the other by itself.
    for (let i = 0; i < RATE_LIMITS.login.limit; i++) await signIn(IZHAR, `guess ${i}`)
    expect((await signIn(IZHAR)).status).toBe(429)
    expect((await signIn(SAMUEL)).status).toBe(429)
  })
})
