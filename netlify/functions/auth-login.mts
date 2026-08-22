import type { Config, Context } from '@netlify/functions'
import { randomBytes } from 'node:crypto'
import { z } from 'zod'
import { record } from '../lib/audit'
import { GENERIC, clientIp, fail, json, publicUser, readBody, wrongMethod } from '../lib/http'
import { hashPassword, verifyPassword } from '../lib/password'
import { Email, PasswordInput } from '../lib/schema'
import { createSession, sessionCookie } from '../lib/sessions'
import { getUserByEmail, saveUser } from '../lib/users'

const Body = z.object({ email: Email, password: PasswordInput })

/**
 * A hash of something nobody knows, verified against when the address is unknown
 * or the account has no password yet.
 *
 * Without it, a sign-in attempt for an address that does not exist returns in a
 * millisecond and one that does takes as long as Argon2id needs, and the
 * difference answers "does this person have an account here?" to anyone with a
 * stopwatch. Computed once per cold start.
 */
let decoy: Promise<string> | null = null
const decoyHash = () => (decoy ??= hashPassword(randomBytes(32).toString('base64url')))

export default async (req: Request, context: Context) => {
  const badMethod = wrongMethod(req, 'POST')
  if (badMethod) return badMethod

  const body = await readBody(req, Body)
  if (!body) return fail(400, GENERIC.badRequest)

  const ip = clientIp(context)
  const now = new Date()
  const user = await getUserByEmail(body.email)

  if (!user) {
    await verifyPassword(body.password, await decoyHash())
    await record(
      {
        action: 'sign_in_failed',
        result: 'failure',
        actorEmail: body.email,
        ip,
        detail: 'no account for that address',
      },
      now,
    )
    return fail(401, GENERIC.signIn)
  }

  if (user.lockedUntil && Date.parse(user.lockedUntil) > now.getTime()) {
    await record(
      {
        action: 'sign_in_failed',
        result: 'failure',
        actorId: user.id,
        actorEmail: user.email,
        ip,
        detail: 'account locked',
      },
      now,
    )
    return fail(401, GENERIC.signIn)
  }

  // Always pay for one verification. An invited account has no hash and a
  // deactivated one is refused whatever the password, and neither should be
  // faster than a real attempt.
  const passwordOk = await verifyPassword(body.password, user.passwordHash ?? (await decoyHash()))
  if (!passwordOk || user.status !== 'active') {
    // The count is kept from here on. The threshold that turns it into a lock is
    // gate 8, along with the rate limits.
    await saveUser({ ...user, failedAttempts: user.failedAttempts + 1 })
    await record(
      {
        action: 'sign_in_failed',
        result: 'failure',
        actorId: user.id,
        actorEmail: user.email,
        ip,
        detail: passwordOk ? `password correct but status is ${user.status}` : 'wrong password',
      },
      now,
    )
    return fail(401, GENERIC.signIn)
  }

  const signedIn = await saveUser({
    ...user,
    failedAttempts: 0,
    lastLoginAt: now.toISOString(),
  })
  const { token } = await createSession(
    { userId: user.id, ip, userAgent: req.headers.get('user-agent') },
    now,
  )
  await record(
    { action: 'sign_in', result: 'success', actorId: user.id, actorEmail: user.email, ip },
    now,
  )

  return json({ user: publicUser(signedIn) }, 200, { 'set-cookie': sessionCookie(token) })
}

export const config: Config = { path: '/api/auth/login' }
