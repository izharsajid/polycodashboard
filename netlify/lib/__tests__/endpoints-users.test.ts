import { beforeEach, describe, expect, it } from 'vitest'
import login from '../../functions/auth-login.mts'
import me from '../../functions/auth-me.mts'
import dataHandler from '../../functions/data.mts'
import listHandler from '../../functions/users-list.mts'
import update from '../../functions/users-update.mts'
import { listAudit } from '../audit'
import { useMemoryStores } from '../kv'
import { getUserByEmail } from '../users'
import { ctx, get, post, seedUser, signedIn } from './helpers'

const PASSWORD = 'brackish tundra ledger'
const IZHAR = 'izhar@ecofibre.bh'
const HAMZA = 'hamza@ecofibre.bh'
const SAMUEL = 'samuel.story-taylor@polycohealthline.com'

beforeEach(() => {
  useMemoryStores()
})

const list = (req: Request) => listHandler(req, ctx())
const data = (req: Request) => dataHandler(req, ctx())

const signIn = (email: string) => login(post('/api/auth/login', { email, password: PASSWORD }), ctx())

/** PATCH is not one of the helper verbs, so build it here. */
function patch(id: string, body: unknown, headers: Record<string, string> = {}) {
  return new Request(`https://dashboard.ecofibre.bh/api/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json', ...headers },
  })
}

const withId = (id: string) => ({ params: { id }, ip: '203.0.113.7' }) as unknown as Parameters<typeof update>[1]

describe('GET /api/users', () => {
  it('refuses without a session', async () => {
    expect((await list(get('/api/users'))).status).toBe(401)
  })

  it('lets any signed-in user see who else is here', async () => {
    await seedUser({ email: IZHAR, password: PASSWORD, name: 'Izhar Sajid', role: 'admin' })
    await seedUser({ email: SAMUEL, password: PASSWORD, name: 'Samuel Story-Taylor' })

    // A member, not an administrator. Transparency runs both ways.
    const res = await list(get('/api/users', signedIn(await signIn(SAMUEL))))
    expect(res.status).toBe(200)

    const { users } = await res.json()
    expect(users.map((u: { email: string }) => u.email)).toEqual([IZHAR, SAMUEL])
  })

  it('never lets a hash, a lockout counter or anything like pay out', async () => {
    await seedUser({ email: IZHAR, password: PASSWORD, role: 'admin' })
    const body = await (await list(get('/api/users', signedIn(await signIn(IZHAR))))).text()

    expect(body).not.toContain('argon2')
    expect(body).not.toContain('passwordHash')
    expect(body).not.toContain('failedAttempts')
    expect(body).not.toContain('lockedUntil')
    expect(body).not.toMatch(/salary|pay|wage/i)
  })
})

describe('PATCH /api/users/:id', () => {
  async function two() {
    const admin = await seedUser({ email: IZHAR, password: PASSWORD, name: 'Izhar Sajid', role: 'admin' })
    const member = await seedUser({ email: SAMUEL, password: PASSWORD, name: 'Samuel Story-Taylor' })
    return { admin, member, headers: signedIn(await signIn(IZHAR)) }
  }

  it('refuses without a session', async () => {
    const { member } = await two()
    const res = await update(patch(member.id, { role: 'admin' }), withId(member.id))
    expect(res.status).toBe(401)
  })

  it('refuses a member calling it directly, and does not change anything', async () => {
    const { admin } = await two()
    const asMember = signedIn(await signIn(SAMUEL))

    const res = await update(patch(admin.id, { role: 'member' }, asMember), withId(admin.id))
    expect(res.status).toBe(403)
    expect((await getUserByEmail(IZHAR))?.role).toBe('admin')
  })

  it('changes a role and records what it was before', async () => {
    const { member, headers } = await two()

    const res = await update(patch(member.id, { role: 'admin' }, headers), withId(member.id))
    expect(res.status).toBe(200)
    expect((await res.json()).user.role).toBe('admin')

    const [entry] = await listAudit({ action: 'role_changed' })
    expect(entry.detail).toBe('member to admin')
    expect(entry.target).toBe(SAMUEL)
    expect(entry.actorEmail).toBe(IZHAR)
  })

  it('deactivates, and the sessions stop at once', async () => {
    const { member, headers } = await two()
    const theirs = signedIn(await signIn(SAMUEL))
    expect((await me(get('/api/auth/me', theirs))).status).toBe(200)

    const res = await update(patch(member.id, { deactivated: true }, headers), withId(member.id))
    expect(res.status).toBe(200)
    expect((await res.json()).user.status).toBe('deactivated')

    expect((await me(get('/api/auth/me', theirs))).status).toBe(401)
    expect((await data(get('/api/data', theirs))).status).toBe(401)
    expect((await signIn(SAMUEL)).status).toBe(401)
  })

  it('reactivates someone who had a password back to active', async () => {
    const { member, headers } = await two()
    await update(patch(member.id, { deactivated: true }, headers), withId(member.id))

    const res = await update(patch(member.id, { deactivated: false }, headers), withId(member.id))
    expect((await res.json()).user.status).toBe('active')
    expect((await signIn(SAMUEL)).status).toBe(200)
    expect((await listAudit({ action: 'user_reactivated' }))[0].detail).toBe('restored to active')
  })

  it('reactivates someone who never accepted back to invited, not active', async () => {
    const { headers } = await two()
    const pending = await seedUser({ email: HAMZA, name: 'Hamza Sajid', role: 'admin' })

    await update(patch(pending.id, { deactivated: true }, headers), withId(pending.id))
    const res = await update(patch(pending.id, { deactivated: false }, headers), withId(pending.id))

    // They still have no password. Active without one is a contradiction.
    expect((await res.json()).user.status).toBe('invited')
  })

  it('will not let an administrator change their own role or deactivate themselves', async () => {
    const { admin, headers } = await two()

    const demote = await update(patch(admin.id, { role: 'member' }, headers), withId(admin.id))
    const remove = await update(patch(admin.id, { deactivated: true }, headers), withId(admin.id))

    expect(demote.status).toBe(403)
    expect(remove.status).toBe(403)
    expect((await getUserByEmail(IZHAR))?.role).toBe('admin')
    expect((await getUserByEmail(IZHAR))?.status).toBe('active')
  })

  it('leaves at least one administrator standing, whatever order things happen in', async () => {
    // Two administrators. Either can remove the other, neither can remove
    // themselves, so the count never reaches zero.
    const { admin, headers } = await two()
    const second = await seedUser({ email: HAMZA, password: PASSWORD, name: 'Hamza Sajid', role: 'admin' })

    expect((await update(patch(second.id, { role: 'member' }, headers), withId(second.id))).status).toBe(200)
    expect((await update(patch(admin.id, { role: 'member' }, headers), withId(admin.id))).status).toBe(403)
    expect((await getUserByEmail(IZHAR))?.role).toBe('admin')
  })

  it('refuses an unknown user and an empty change', async () => {
    const { member, headers } = await two()
    expect((await update(patch('nobody', { role: 'admin' }, headers), withId('nobody'))).status).toBe(404)
    expect((await update(patch(member.id, {}, headers), withId(member.id))).status).toBe(400)
  })

  it('refuses the wrong method', async () => {
    const { member, headers } = await two()
    const res = await update(get(`/api/users/${member.id}`, headers), withId(member.id))
    expect(res.status).toBe(405)
  })
})
