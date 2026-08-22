import { beforeEach, describe, expect, it } from 'vitest'
import accept from '../../functions/invitations-accept.mts'
import validate from '../../functions/invitations-validate.mts'
import login from '../../functions/auth-login.mts'
import me from '../../functions/auth-me.mts'
import invite from '../../functions/users-invite.mts'
import { listAudit } from '../audit'
import { type Delivery, onDeliver } from '../delivery'
import { issueToken } from '../invitations'
import { useMemoryStores } from '../kv'
import { getUserByEmail } from '../users'
import { ctx, get, post, seedUser, signedIn } from './helpers'

const PASSWORD = 'brackish tundra ledger'
const NEW_PASSWORD = 'a different arrangement'
const IZHAR = 'izhar@ecofibre.bh'
const SAMUEL = 'samuel.story-taylor@polycohealthline.com'

let sent: Delivery[] = []

beforeEach(() => {
  useMemoryStores()
  sent = []
  onDeliver(async (delivery) => {
    sent.push(delivery)
  })
})

const signIn = (email: string, password = PASSWORD) =>
  login(post('/api/auth/login', { email, password }), ctx())

async function asAdmin() {
  await seedUser({ email: IZHAR, password: PASSWORD, name: 'Izhar Sajid', role: 'admin' })
  return signedIn(await signIn(IZHAR))
}

async function asMember(email = SAMUEL) {
  await seedUser({ email, password: PASSWORD, name: 'Samuel Story-Taylor', role: 'member' })
  return signedIn(await signIn(email))
}

const sendInvite = (body: unknown, headers: Record<string, string> = {}) =>
  invite(post('/api/users/invite', body, headers), ctx())

describe('POST /api/users/invite', () => {
  it('refuses without a session', async () => {
    const res = await sendInvite({ email: SAMUEL, name: 'Samuel Story-Taylor' })
    expect(res.status).toBe(401)
  })

  it('lets an administrator invite either domain', async () => {
    const headers = await asAdmin()

    const polyco = await sendInvite({ email: SAMUEL, name: 'Samuel Story-Taylor' }, headers)
    const ecofibre = await sendInvite(
      { email: 'hamza@ecofibre.bh', name: 'Hamza Sajid', role: 'admin' },
      headers,
    )

    expect(polyco.status).toBe(201)
    expect(ecofibre.status).toBe(201)
    expect((await polyco.json()).user.status).toBe('invited')
    expect((await ecofibre.json()).user.role).toBe('admin')
    expect(sent.map((d) => d.email)).toEqual([SAMUEL, 'hamza@ecofibre.bh'])
  })

  it('lets a member invite a colleague at their own domain', async () => {
    const headers = await asMember()
    const res = await sendInvite(
      { email: 'andy.blewett@polycohealthline.com', name: 'Andy Blewett' },
      headers,
    )

    expect(res.status).toBe(201)
    expect((await res.json()).user.role).toBe('member')
  })

  it('stops a member inviting across domains, and logs it', async () => {
    const headers = await asMember()
    const res = await sendInvite({ email: 'someone@ecofibre.bh', name: 'Someone' }, headers)

    expect(res.status).toBe(403)
    expect((await res.json()).error).toMatch(/your own domain/)
    expect(sent).toHaveLength(0)

    const [entry] = await listAudit({ action: 'invitation_refused_domain' })
    expect(entry.detail).toBe('not_your_domain')
    expect(entry.target).toBe('someone@ecofibre.bh')
    expect(entry.actorEmail).toBe(SAMUEL)
  })

  it('stops a member appointing an administrator, even at their own domain', async () => {
    const headers = await asMember()
    const res = await sendInvite(
      { email: 'andy.blewett@polycohealthline.com', name: 'Andy Blewett', role: 'admin' },
      headers,
    )

    expect(res.status).toBe(403)
    expect(await getUserByEmail('andy.blewett@polycohealthline.com')).toBeNull()
    expect((await listAudit({ action: 'invitation_refused_domain' }))[0].detail).toBe(
      'members_cannot_appoint_administrators',
    )
  })

  it('refuses a domain outside the permitted list, for an administrator too', async () => {
    const headers = await asAdmin()
    const res = await sendInvite({ email: 'someone@gmail.com', name: 'Someone' }, headers)

    expect(res.status).toBe(403)
    expect(sent).toHaveLength(0)
    expect((await listAudit({ action: 'invitation_refused_domain' }))[0].detail).toBe(
      'domain_not_permitted',
    )
  })

  it('refuses an address that already has an active account', async () => {
    const headers = await asAdmin()
    await seedUser({ email: 'andy.blewett@polycohealthline.com', password: PASSWORD })

    const res = await sendInvite(
      { email: 'andy.blewett@polycohealthline.com', name: 'Andy Blewett' },
      headers,
    )
    expect(res.status).toBe(409)
    expect(sent).toHaveLength(0)
  })

  it('re-inviting kills the previous link', async () => {
    const headers = await asAdmin()
    await sendInvite({ email: SAMUEL, name: 'Samuel Story-Taylor' }, headers)
    await sendInvite({ email: SAMUEL, name: 'Samuel Story-Taylor' }, headers)

    const [first, second] = sent
    expect((await validate(post('/api/invitations/validate', { token: first.token }))).status).toBe(410)
    expect((await validate(post('/api/invitations/validate', { token: second.token }))).status).toBe(200)
  })

  it('never returns the token, and never writes it to the log', async () => {
    const headers = await asAdmin()
    const res = await sendInvite({ email: SAMUEL, name: 'Samuel Story-Taylor' }, headers)

    expect(await res.text()).not.toContain(sent[0].token)
    expect(JSON.stringify(await listAudit())).not.toContain(sent[0].token)
  })
})

describe('POST /api/invitations/validate', () => {
  it('returns the invited address and nothing else', async () => {
    const headers = await asAdmin()
    await sendInvite({ email: SAMUEL, name: 'Samuel Story-Taylor' }, headers)

    const res = await validate(post('/api/invitations/validate', { token: sent[0].token }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ email: SAMUEL })
  })

  it('refuses an unknown, expired or wrong-kind token', async () => {
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000)
    const stale = await issueToken(
      { email: SAMUEL, role: 'member', purpose: 'invitation' },
      eightDaysAgo,
    )
    const reset = await issueToken({ email: SAMUEL, role: 'member', purpose: 'reset' })

    for (const token of ['never-issued', stale.token, reset.token]) {
      const res = await validate(post('/api/invitations/validate', { token }))
      // 410 Gone, not 400: the link is finished, rather than the caller having
      // sent something malformed. The page shows a different screen for each.
      expect(res.status).toBe(410)
      expect((await res.json()).error).toMatch(/no longer valid/)
    }
  })
})

describe('POST /api/invitations/accept', () => {
  const use = (token: string, password = NEW_PASSWORD) =>
    accept(post('/api/invitations/accept', { token, password }), ctx())

  async function invited() {
    const headers = await asAdmin()
    await sendInvite({ email: SAMUEL, name: 'Samuel Story-Taylor' }, headers)
    return sent[0].token
  }

  it('activates the account and signs them straight in', async () => {
    const res = await use(await invited())

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.user.email).toBe(SAMUEL)
    expect(body.user.status).toBe('active')
    expect(body.user.role).toBe('member')

    expect((await me(get('/api/auth/me', signedIn(res)))).status).toBe(200)
    expect((await signIn(SAMUEL, NEW_PASSWORD)).status).toBe(200)
  })

  it('takes the role from the invitation, not from the caller', async () => {
    const token = await invited()
    const res = await accept(
      post('/api/invitations/accept', { token, password: NEW_PASSWORD, role: 'admin' }),
      ctx(),
    )
    expect((await res.json()).user.role).toBe('member')
  })

  it('cannot be replayed', async () => {
    const token = await invited()
    expect((await use(token)).status).toBe(200)

    const replay = await use(token, 'yet another phrase')
    expect(replay.status).toBe(410)
    expect((await signIn(SAMUEL, 'yet another phrase')).status).toBe(401)
  })

  it('does not burn the link when the password is refused', async () => {
    const token = await invited()

    const weak = await use(token, 'password1234')
    expect(weak.status).toBe(400)
    expect((await weak.json()).error).toMatch(/well known/)

    expect((await use(token)).status).toBe(200)
  })

  it('refuses an expired link', async () => {
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000)
    await seedUser({ email: SAMUEL, name: 'Samuel Story-Taylor' })
    const { token } = await issueToken(
      { email: SAMUEL, role: 'member', purpose: 'invitation' },
      eightDaysAgo,
    )

    expect((await use(token)).status).toBe(410)
    expect((await getUserByEmail(SAMUEL))?.status).toBe('invited')
  })

  it('refuses a link for an account that is already active', async () => {
    const token = await invited()
    expect((await use(token)).status).toBe(200)

    const second = await issueToken({ email: SAMUEL, role: 'member', purpose: 'invitation' })
    const res = await use(second.token, 'a third arrangement entirely')

    expect(res.status).toBe(410)
    expect((await listAudit({ action: 'invitation_accepted' }))[0].detail).toMatch(
      /status is active/,
    )
  })

  it('records the acceptance without the token', async () => {
    const token = await invited()
    await use(token)

    const entries = await listAudit({ action: 'invitation_accepted' })
    expect(entries[0].result).toBe('success')
    expect(entries[0].actorEmail).toBe(SAMUEL)
    expect(JSON.stringify(entries)).not.toContain(token)
  })
})
