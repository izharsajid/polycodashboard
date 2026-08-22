import { beforeEach, describe, expect, it } from 'vitest'
import forgot from '../../functions/auth-forgot.mts'
import login from '../../functions/auth-login.mts'
import me from '../../functions/auth-me.mts'
import reset from '../../functions/auth-reset.mts'
import { listAudit } from '../audit'
import { type Delivery, onDeliver, resetDelivery } from '../delivery'
import { issueToken } from '../invitations'
import { useMemoryStores } from '../kv'
import { ctx, get, post, seedUser, signedIn } from './helpers'

const PASSWORD = 'brackish tundra ledger'
const NEW_PASSWORD = 'a different arrangement'
const IZHAR = 'izhar@ecofibre.bh'

let sent: Delivery[] = []

beforeEach(() => {
  useMemoryStores()
  sent = []
  onDeliver(async (delivery) => {
    sent.push(delivery)
  })
})

const ask = (email: string) => forgot(post('/api/auth/forgot', { email }), ctx())
const signIn = (email: string, password: string) =>
  login(post('/api/auth/login', { email, password }), ctx())

describe('POST /api/auth/forgot', () => {
  it('answers a known address, an unknown one and a deactivated one identically', async () => {
    await seedUser({ email: IZHAR, password: PASSWORD })
    await seedUser({ email: 'gone@ecofibre.bh', password: PASSWORD, status: 'deactivated' })

    const known = await ask(IZHAR)
    const unknown = await ask('nobody@ecofibre.bh')
    const deactivated = await ask('gone@ecofibre.bh')

    expect(known.status).toBe(200)
    expect(unknown.status).toBe(200)
    expect(deactivated.status).toBe(200)

    const bodies = [await known.text(), await unknown.text(), await deactivated.text()]
    expect(new Set(bodies).size).toBe(1)
  })

  it('issues a link only for an account that can use one', async () => {
    await seedUser({ email: IZHAR, password: PASSWORD })

    await ask(IZHAR)
    await ask('nobody@ecofibre.bh')

    expect(sent).toHaveLength(1)
    expect(sent[0]).toMatchObject({ kind: 'reset', email: IZHAR })
  })

  it('sends nothing at all unless something is listening', async () => {
    // The default. AUTH-SPEC section 1: no email leaves the system until Izhar
    // says so, and there is no provider wired in.
    resetDelivery()
    await seedUser({ email: IZHAR, password: PASSWORD })

    const res = await ask(IZHAR)
    expect(res.status).toBe(200)
    expect(sent).toHaveLength(0)
    expect((await listAudit({ action: 'password_reset_requested' }))[0].result).toBe('success')
  })

  it('kills the previous link when a second is asked for', async () => {
    await seedUser({ email: IZHAR, password: PASSWORD })
    await ask(IZHAR)
    await ask(IZHAR)

    const [first, second] = sent
    const stale = await reset(post('/api/auth/reset', { token: first.token, password: NEW_PASSWORD }), ctx())
    expect(stale.status).toBe(400)

    const fresh = await reset(post('/api/auth/reset', { token: second.token, password: NEW_PASSWORD }), ctx())
    expect(fresh.status).toBe(200)
  })

  it('records both outcomes without writing the token down', async () => {
    await seedUser({ email: IZHAR, password: PASSWORD })
    await ask(IZHAR)
    await ask('nobody@ecofibre.bh')

    // Both land in the same millisecond, and two entries sharing a timestamp have
    // no order between them, so assert on what was written rather than on when.
    const entries = await listAudit({ action: 'password_reset_requested' })
    expect(entries).toHaveLength(2)
    expect(entries.find((e) => e.result === 'success')?.actorEmail).toBe(IZHAR)
    expect(entries.find((e) => e.result === 'failure')?.actorEmail).toBe('nobody@ecofibre.bh')
    expect(JSON.stringify(entries)).not.toContain(sent[0].token)
  })

  it('refuses a malformed body and the wrong method', async () => {
    expect((await forgot(post('/api/auth/forgot', { email: 'nope' }), ctx())).status).toBe(400)
    expect((await forgot(get('/api/auth/forgot'), ctx())).status).toBe(405)
  })
})

describe('POST /api/auth/reset', () => {
  const use = (token: string, password = NEW_PASSWORD) =>
    reset(post('/api/auth/reset', { token, password }), ctx())

  it('sets the new password and signs the person in', async () => {
    await seedUser({ email: IZHAR, password: PASSWORD, name: 'Izhar Sajid' })
    await ask(IZHAR)

    const res = await use(sent[0].token)
    expect(res.status).toBe(200)
    expect((await res.json()).user.email).toBe(IZHAR)

    expect((await me(get('/api/auth/me', signedIn(res)))).status).toBe(200)
    expect((await signIn(IZHAR, NEW_PASSWORD)).status).toBe(200)
    expect((await signIn(IZHAR, PASSWORD)).status).toBe(401)
  })

  it('signs out every session that existed before', async () => {
    await seedUser({ email: IZHAR, password: PASSWORD })
    const before = signedIn(await signIn(IZHAR, PASSWORD))
    await ask(IZHAR)

    await use(sent[0].token)
    expect((await me(get('/api/auth/me', before))).status).toBe(401)
  })

  it('cannot be replayed', async () => {
    await seedUser({ email: IZHAR, password: PASSWORD })
    await ask(IZHAR)

    expect((await use(sent[0].token)).status).toBe(200)
    const replay = await use(sent[0].token, 'yet another phrase')
    expect(replay.status).toBe(400)
    expect((await replay.json()).error).toMatch(/no longer valid/)
  })

  it('does not burn the token when the new password is refused', async () => {
    await seedUser({ email: IZHAR, password: PASSWORD })
    await ask(IZHAR)

    const weak = await use(sent[0].token, 'password1234')
    expect(weak.status).toBe(400)
    expect((await weak.json()).error).toMatch(/well known/)

    // The link still works. Somebody who mistyped is not locked out for it.
    expect((await use(sent[0].token)).status).toBe(200)
  })

  it('refuses an expired token', async () => {
    await seedUser({ email: IZHAR, password: PASSWORD })
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000)
    const { token } = await issueToken(
      { email: IZHAR, role: 'member', purpose: 'reset' },
      twoHoursAgo,
    )

    expect((await use(token)).status).toBe(400)
    expect((await signIn(IZHAR, PASSWORD)).status).toBe(200)
  })

  it('refuses a token that was never issued, and an invitation offered as a reset', async () => {
    await seedUser({ email: IZHAR, password: PASSWORD })
    const invitation = await issueToken({ email: IZHAR, role: 'member', purpose: 'invitation' })

    expect((await use('nobody-issued-this')).status).toBe(400)
    expect((await use(invitation.token)).status).toBe(400)
  })

  it('refuses when the account went away in the meantime', async () => {
    const { token } = await issueToken({ email: 'ghost@ecofibre.bh', role: 'member', purpose: 'reset' })
    const res = await use(token)

    expect(res.status).toBe(400)
    expect((await listAudit({ action: 'password_reset_completed' }))[0].detail).toMatch(
      /no longer exists/,
    )
  })

  it('records the completion without the token', async () => {
    await seedUser({ email: IZHAR, password: PASSWORD })
    await ask(IZHAR)
    await use(sent[0].token)

    const [entry] = await listAudit({ action: 'password_reset_completed' })
    expect(entry.result).toBe('success')
    expect(entry.actorEmail).toBe(IZHAR)
    expect(JSON.stringify(entry)).not.toContain(sent[0].token)
  })
})
