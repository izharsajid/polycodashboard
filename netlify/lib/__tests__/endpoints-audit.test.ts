import { beforeEach, describe, expect, it } from 'vitest'
import auditHandler from '../../functions/audit.mts'
import login from '../../functions/auth-login.mts'
import logout from '../../functions/auth-logout.mts'
import invite from '../../functions/users-invite.mts'
import update from '../../functions/users-update.mts'
import { record } from '../audit'
import { onDeliver } from '../delivery'
import { useMemoryStores } from '../kv'
import { getUserByEmail } from '../users'
import { ctx, get, post, seedUser, signedIn } from './helpers'

const PASSWORD = 'brackish tundra ledger'
const IZHAR = 'izhar@ecofibre.bh'
const SAMUEL = 'samuel.story-taylor@polycohealthline.com'

beforeEach(() => {
  useMemoryStores()
  onDeliver(async () => {})
})

const auditEndpoint = (req: Request) => auditHandler(req, ctx())

const signIn = (email: string, password = PASSWORD) =>
  login(post('/api/auth/login', { email, password }), ctx())

const read = (query = '', headers: Record<string, string> = {}) =>
  auditEndpoint(get(`/api/audit${query}`, headers))

describe('GET /api/audit', () => {
  it('refuses without a session', async () => {
    expect((await read()).status).toBe(401)
  })

  it('refuses a member calling it directly', async () => {
    await seedUser({ email: SAMUEL, password: PASSWORD, name: 'Samuel Story-Taylor' })
    const res = await read('', signedIn(await signIn(SAMUEL)))

    expect(res.status).toBe(403)
    expect(await res.text()).not.toMatch(/sign_in|actorEmail/)
  })

  it('gives an administrator the log, newest first', async () => {
    await seedUser({ email: IZHAR, password: PASSWORD, name: 'Izhar Sajid', role: 'admin' })
    await signIn(IZHAR, 'the wrong one')
    const headers = signedIn(await signIn(IZHAR))

    const res = await read('', headers)
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.entries[0].action).toBe('sign_in')
    expect(body.entries[1].action).toBe('sign_in_failed')
    expect(body.nextCursor).toBeNull()
  })

  it('filters by action, by actor and by date', async () => {
    await seedUser({ email: IZHAR, password: PASSWORD, name: 'Izhar Sajid', role: 'admin' })
    const headers = signedIn(await signIn(IZHAR))
    await record({ action: 'data_edited', result: 'success', actorId: 'someone-else' })

    const byAction = await (await read('?action=data_edited', headers)).json()
    expect(byAction.entries).toHaveLength(1)

    const byActor = await (await read('?actorId=someone-else', headers)).json()
    expect(byActor.entries).toHaveLength(1)

    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString()
    const byDate = await (await read(`?from=${encodeURIComponent(future)}`, headers)).json()
    expect(byDate.entries).toHaveLength(0)
  })

  it('pages, and the cursor carries the filter with it', async () => {
    await seedUser({ email: IZHAR, password: PASSWORD, name: 'Izhar Sajid', role: 'admin' })
    const headers = signedIn(await signIn(IZHAR))
    for (let i = 0; i < 6; i++) {
      await record({ action: 'export_downloaded', result: 'success', actorId: 'a' })
    }

    const first = await (await read('?action=export_downloaded&limit=4', headers)).json()
    expect(first.entries).toHaveLength(4)
    expect(first.nextCursor).not.toBeNull()

    const second = await (
      await read(
        `?action=export_downloaded&limit=4&cursor=${encodeURIComponent(first.nextCursor)}`,
        headers,
      )
    ).json()
    expect(second.entries).toHaveLength(2)
    expect(second.nextCursor).toBeNull()
  })

  it('refuses a query it cannot read rather than guessing', async () => {
    await seedUser({ email: IZHAR, password: PASSWORD, role: 'admin' })
    const headers = signedIn(await signIn(IZHAR))

    expect((await read('?action=not_a_real_action', headers)).status).toBe(400)
    expect((await read('?from=yesterday', headers)).status).toBe(400)
  })

  it('offers no way to write or remove an entry', async () => {
    await seedUser({ email: IZHAR, password: PASSWORD, role: 'admin' })
    const headers = signedIn(await signIn(IZHAR))

    for (const method of ['POST', 'DELETE', 'PATCH', 'PUT']) {
      const req = new Request('https://dashboard.ecofibre.bh/api/audit', { method, headers })
      expect((await auditEndpoint(req)).status).toBe(405)
    }
  })
})

describe('what actually reaches the log', () => {
  /**
   * AUTH-SPEC section 7 lists what must be recorded. This walks a real sequence
   * through the real endpoints and checks the log afterwards, rather than
   * trusting that each one remembered.
   */
  it('captures a full sign-in, invite, role change and sign-out', async () => {
    const admin = await seedUser({
      email: IZHAR,
      password: PASSWORD,
      name: 'Izhar Sajid',
      role: 'admin',
    })
    const headers = signedIn(await signIn(IZHAR))

    await invite(post('/api/users/invite', { email: SAMUEL, name: 'Samuel Story-Taylor' }, headers), ctx())
    await invite(post('/api/users/invite', { email: 'outside@gmail.com', name: 'Outside' }, headers), ctx())

    const invited = await (
      await auditEndpoint(get('/api/audit?action=invitation_sent', headers))
    ).json()
    const targetEmail = invited.entries[0].target

    const samuel = await getUserByEmail(targetEmail)

    await update(
      new Request(`https://dashboard.ecofibre.bh/api/users/${samuel!.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ role: 'admin' }),
        headers: { 'content-type': 'application/json', ...headers },
      }),
      { params: { id: samuel!.id }, ip: '203.0.113.7' } as unknown as Parameters<typeof update>[1],
    )

    await logout(post('/api/auth/logout', {}, headers), ctx())

    // Sign back in to read the log.
    const again = signedIn(await signIn(IZHAR))
    const body = await (await read('?limit=200', again)).json()
    const actions = body.entries.map((e: { action: string }) => e.action)

    expect(actions).toContain('sign_in')
    expect(actions).toContain('invitation_sent')
    expect(actions).toContain('invitation_refused_domain')
    expect(actions).toContain('role_changed')
    expect(actions).toContain('sign_out')

    // Who, what, when, from where, and how it went.
    const roleChange = body.entries.find((e: { action: string }) => e.action === 'role_changed')
    expect(roleChange.actorId).toBe(admin.id)
    expect(roleChange.actorEmail).toBe(IZHAR)
    expect(roleChange.target).toBe(SAMUEL)
    expect(roleChange.ip).toBe('203.0.113.7')
    expect(roleChange.result).toBe('success')
    expect(roleChange.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('never carries a password, a session cookie or a link token', async () => {
    await seedUser({ email: IZHAR, password: PASSWORD, name: 'Izhar Sajid', role: 'admin' })
    const signedInRes = await signIn(IZHAR)
    const headers = signedIn(signedInRes)
    const sessionToken = headers.cookie.split('=')[1]

    let issued = ''
    onDeliver(async (d) => {
      issued = d.token
    })
    await invite(post('/api/users/invite', { email: SAMUEL, name: 'Samuel Story-Taylor' }, headers), ctx())

    const body = await (await read('?limit=200', headers)).text()
    expect(body).not.toContain(PASSWORD)
    expect(body).not.toContain(sessionToken)
    expect(issued.length).toBeGreaterThan(20)
    expect(body).not.toContain(issued)
  })
})
