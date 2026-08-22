import type { Config, Context } from '@netlify/functions'
import { z } from 'zod'
import { record } from '../lib/audit'
import { GENERIC, clientIp, fail, json, publicUser, readBody, wrongMethod } from '../lib/http'
import { consumeToken, readToken } from '../lib/invitations'
import { checkPassword, hashPassword } from '../lib/password'
import { PasswordInput } from '../lib/schema'
import { createSession, sessionCookie } from '../lib/sessions'
import { getUserByEmail, saveUser } from '../lib/users'

const Body = z.object({ token: z.string().min(1).max(200), password: PasswordInput })

/**
 * Setting a password for the first time, which is the only way an account becomes
 * active apart from the local seed script.
 *
 * Read first, consume last, as the reset endpoint does: burning the token before
 * checking the password would leave somebody holding a dead link because of a
 * typo, on the one link they were given.
 */
export default async (req: Request, context: Context) => {
  const badMethod = wrongMethod(req, 'POST')
  if (badMethod) return badMethod

  const body = await readBody(req, Body)
  if (!body) return fail(400, GENERIC.badRequest)

  const ip = clientIp(context)

  const held = await readToken(body.token, 'invitation')
  if (!held.ok) {
    await record({
      action: 'invitation_accepted',
      result: 'failure',
      ip,
      detail: `invitation token ${held.reason}`,
    })
    return fail(400, GENERIC.link)
  }

  const user = await getUserByEmail(held.invitation.email)
  if (!user || user.status !== 'invited') {
    await record({
      action: 'invitation_accepted',
      result: 'failure',
      actorEmail: held.invitation.email,
      ip,
      detail: user ? `account status is ${user.status}` : 'account no longer exists',
    })
    return fail(400, GENERIC.link)
  }

  const verdict = checkPassword(body.password, { email: user.email, name: user.name })
  if (!verdict.ok) return fail(400, verdict.reason)

  const consumed = await consumeToken(body.token, 'invitation')
  if (!consumed.ok) {
    await record({
      action: 'invitation_accepted',
      result: 'failure',
      actorId: user.id,
      actorEmail: user.email,
      ip,
      detail: `invitation token ${consumed.reason} before it could be used`,
    })
    return fail(400, GENERIC.link)
  }

  const now = new Date()
  const activated = await saveUser({
    ...user,
    // The role is taken from the invitation, not from anything the caller sent.
    role: consumed.invitation.role,
    status: 'active',
    passwordHash: await hashPassword(body.password),
    failedAttempts: 0,
    lockedUntil: null,
    lastLoginAt: now.toISOString(),
  })

  const { token } = await createSession(
    { userId: user.id, ip, userAgent: req.headers.get('user-agent') },
    now,
  )

  await record(
    {
      action: 'invitation_accepted',
      result: 'success',
      actorId: user.id,
      actorEmail: user.email,
      ip,
      detail: `activated as ${activated.role}`,
    },
    now,
  )

  return json({ user: publicUser(activated) }, 200, { 'set-cookie': sessionCookie(token) })
}

export const config: Config = { path: '/api/invitations/accept' }
