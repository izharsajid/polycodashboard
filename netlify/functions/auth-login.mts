import type { Config, Context } from '@netlify/functions'
import { randomBytes } from 'node:crypto'
import { z } from 'zod'
import { record } from '../lib/audit'
import { LOCKOUT_MS, LOCKOUT_THRESHOLD, RATE_LIMITS } from '../lib/config'
import {
  GENERIC,
  clientIp,
  fail,
  json,
  publicUser,
  readBody,
  refuseTooMany,
  wrongMethod,
} from '../lib/http'
import { hashPassword, verifyPassword } from '../lib/password'
import { take } from '../lib/rate-limit'
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

  // Before the lookup and before Argon2id, so that neither is work an attacker
  // can make us do repeatedly.
  if (ip) {
    const byIp = await take('login-ip', ip, RATE_LIMITS.login, now)
    if (!byIp.allowed) {
      return refuseTooMany(byIp, { ip, actorEmail: body.email, detail: 'login attempts from one address' })
    }
  }
  const byAccount = await take('login-account', body.email, RATE_LIMITS.login, now)
  if (!byAccount.allowed) {
    return refuseTooMany(byAccount, { ip, actorEmail: body.email, detail: 'login attempts on one account' })
  }

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

  let current = user

  if (current.lockedUntil) {
    if (Date.parse(current.lockedUntil) > now.getTime()) {
      await record(
        {
          action: 'sign_in_failed',
          result: 'failure',
          actorId: current.id,
          actorEmail: current.email,
          ip,
          detail: `account locked until ${current.lockedUntil}`,
        },
        now,
      )
      return fail(401, GENERIC.signIn)
    }

    // The lock has run its course. There is no background job to lift it, so it
    // is lifted here, on the next attempt, and the log gets its matching pair.
    current = await saveUser({ ...current, lockedUntil: null, failedAttempts: 0 })
    await record(
      {
        action: 'account_unlocked',
        result: 'success',
        actorId: current.id,
        actorEmail: current.email,
        ip,
        detail: 'lock expired',
      },
      now,
    )
  }

  // Always pay for one verification. An invited account has no hash and a
  // deactivated one is refused whatever the password, and neither should be
  // faster than a real attempt.
  const passwordOk = await verifyPassword(
    body.password,
    current.passwordHash ?? (await decoyHash()),
  )
  if (!passwordOk || current.status !== 'active') {
    const failedAttempts = current.failedAttempts + 1
    const locked = failedAttempts >= LOCKOUT_THRESHOLD

    await saveUser({
      ...current,
      failedAttempts,
      lockedUntil: locked ? new Date(now.getTime() + LOCKOUT_MS).toISOString() : current.lockedUntil,
    })

    await record(
      {
        action: 'sign_in_failed',
        result: 'failure',
        actorId: current.id,
        actorEmail: current.email,
        ip,
        detail: passwordOk
          ? `password correct but status is ${current.status}`
          : `wrong password, ${failedAttempts} in a row`,
      },
      now,
    )

    if (locked) {
      await record(
        {
          action: 'account_locked',
          result: 'success',
          actorId: current.id,
          actorEmail: current.email,
          ip,
          detail: `${failedAttempts} consecutive failures, locked for ${LOCKOUT_MS / 60000} minutes`,
        },
        now,
      )
    }
    return fail(401, GENERIC.signIn)
  }

  // Consecutive means consecutive. One success clears the count.
  const signedIn = await saveUser({
    ...current,
    failedAttempts: 0,
    lockedUntil: null,
    lastLoginAt: now.toISOString(),
  })
  const { token } = await createSession(
    { userId: current.id, ip, userAgent: req.headers.get('user-agent') },
    now,
  )
  await record(
    { action: 'sign_in', result: 'success', actorId: current.id, actorEmail: current.email, ip },
    now,
  )

  return json({ user: publicUser(signedIn) }, 200, { 'set-cookie': sessionCookie(token) })
}

export const config: Config = { path: '/api/auth/login' }
