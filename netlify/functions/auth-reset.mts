import type { Config, Context } from '@netlify/functions'
import { z } from 'zod'
import { record } from '../lib/audit'
import { GENERIC, clientIp, fail, json, publicUser, readBody, wrongMethod } from '../lib/http'
import { consumeToken, readToken } from '../lib/invitations'
import { checkPassword, hashPassword } from '../lib/password'
import { PasswordInput } from '../lib/schema'
import { createSession, revokeUserSessions, sessionCookie } from '../lib/sessions'
import { getUserByEmail, saveUser } from '../lib/users'

const Body = z.object({ token: z.string().min(1).max(200), password: PasswordInput })

/**
 * The token arrives in the body, not the path. AUTH-SPEC section 9: a token must
 * not sit in a URL, because URLs end up in access logs, in browser history and in
 * the referrer header of the next request.
 */
export default async (req: Request, context: Context) => {
  const badMethod = wrongMethod(req, 'POST')
  if (badMethod) return badMethod

  const body = await readBody(req, Body)
  if (!body) return fail(400, GENERIC.badRequest)

  const ip = clientIp(context)

  // Read first, consume last. Checking the password against the policy after
  // burning the token would leave somebody holding a dead link and no way back
  // in, for the sake of a typo.
  const held = await readToken(body.token, 'reset')
  if (!held.ok) {
    await record({
      action: 'password_reset_completed',
      result: 'failure',
      ip,
      detail: `reset token ${held.reason}`,
    })
    return fail(410, GENERIC.link)
  }

  const user = await getUserByEmail(held.invitation.email)
  if (!user || user.status !== 'active') {
    await record({
      action: 'password_reset_completed',
      result: 'failure',
      actorEmail: held.invitation.email,
      ip,
      detail: user ? `account status is ${user.status}` : 'account no longer exists',
    })
    return fail(410, GENERIC.link)
  }

  const verdict = checkPassword(body.password, { email: user.email, name: user.name })
  if (!verdict.ok) return fail(400, verdict.reason)

  const consumed = await consumeToken(body.token, 'reset')
  if (!consumed.ok) {
    await record({
      action: 'password_reset_completed',
      result: 'failure',
      actorId: user.id,
      actorEmail: user.email,
      ip,
      detail: `reset token ${consumed.reason} before it could be used`,
    })
    return fail(410, GENERIC.link)
  }

  const now = new Date()
  const updated = await saveUser({
    ...user,
    passwordHash: await hashPassword(body.password),
    failedAttempts: 0,
    lockedUntil: null,
    lastLoginAt: now.toISOString(),
  })

  // Every session, with none kept. A reset is what someone does when they may
  // have lost control of the account, so the sessions they cannot see go too.
  const revoked = await revokeUserSessions(user.id)

  const { token } = await createSession(
    { userId: user.id, ip, userAgent: req.headers.get('user-agent') },
    now,
  )

  await record(
    {
      action: 'password_reset_completed',
      result: 'success',
      actorId: user.id,
      actorEmail: user.email,
      ip,
      detail: `${revoked} ${revoked === 1 ? 'session' : 'sessions'} signed out`,
    },
    now,
  )

  // Signed in on the way out, as AUTH-SPEC section 8 has the invitation page do.
  return json({ user: publicUser(updated) }, 200, { 'set-cookie': sessionCookie(token) })
}

export const config: Config = { path: '/api/auth/reset' }
