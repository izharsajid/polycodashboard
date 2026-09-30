import type { Config, Context } from '@netlify/functions'
import { z } from 'zod'
import { record } from '../lib/audit'
import {
  GENERIC,
  authenticate,
  clientIp,
  fail,
  json,
  readBody,
  wrongMethod,
} from '../lib/http'
import { checkPassword, hashPassword, verifyPassword } from '../lib/password'
import { PasswordInput } from '../lib/schema'
import { revokeUserSessions } from '../lib/sessions'
import { saveUser } from '../lib/users'

const Body = z.object({ currentPassword: PasswordInput, newPassword: PasswordInput })

export default async (req: Request, context: Context) => {
  const badMethod = wrongMethod(req, 'POST')
  if (badMethod) return badMethod

  const authed = await authenticate(req)
  if (!authed) return fail(401, GENERIC.session)

  const body = await readBody(req, Body)
  if (!body) return fail(400, GENERIC.badRequest)

  const ip = clientIp(context)
  const { user, token } = authed

  if (!(await verifyPassword(body.currentPassword, user.passwordHash))) {
    await record({
      action: 'password_changed',
      result: 'failure',
      actorId: user.id,
      actorEmail: user.email,
      ip,
      detail: 'current password did not match',
    })
    // Specific, and safe to be: the caller is already signed in as this account,
    // so it tells them nothing they did not already know. The generic rule exists
    // to stop the outside world learning who has an account.
    return fail(400, 'That is not your current password.')
  }

  const verdict = checkPassword(body.newPassword, { email: user.email, name: user.name })
  if (!verdict.ok) return fail(400, verdict.reason)

  await saveUser({ ...user, passwordHash: await hashPassword(body.newPassword) })

  // AUTH-SPEC section 6. Everywhere else is signed out; this session stays, so
  // changing a password does not eject the person who just changed it.
  const revoked = await revokeUserSessions(user.id, token)

  await record({
    action: 'password_changed',
    result: 'success',
    actorId: user.id,
    actorEmail: user.email,
    ip,
    detail: `${revoked} other ${revoked === 1 ? 'session' : 'sessions'} signed out`,
  })

  return json({ ok: true, otherSessionsSignedOut: revoked })
}

export const config: Config = { path: '/api/auth/password' }
