import type { Config, Context } from '@netlify/functions'
import { z } from 'zod'
import { record } from '../lib/audit'
import { deliver } from '../lib/delivery'
import { RATE_LIMITS } from '../lib/config'
import { GENERIC, clientIp, fail, json, readBody, refuseTooMany, wrongMethod } from '../lib/http'
import { issueToken, revokeTokensFor } from '../lib/invitations'
import { take } from '../lib/rate-limit'
import { Email } from '../lib/schema'
import { getUserByEmail } from '../lib/users'

const Body = z.object({ email: Email })

/**
 * AUTH-SPEC section 4: the response is identical whether or not the address
 * exists, so the endpoint cannot be used to discover who has an account.
 *
 * That means one body, one status and no branch a caller can time or read. The
 * difference between the two cases lives in the audit log, where it belongs.
 *
 * Nothing is sent. See lib/delivery.ts: a reset token is issued and recorded, and
 * the link goes nowhere until a provider is chosen and Izhar releases it.
 */
const SAME_ANSWER = {
  ok: true,
  message: 'If that address has an account, a reset link is on its way.',
}

export default async (req: Request, context: Context) => {
  const badMethod = wrongMethod(req, 'POST')
  if (badMethod) return badMethod

  const body = await readBody(req, Body)
  // Even a malformed address gets the same shape of answer, so that a bad request
  // cannot be used to probe either.
  if (!body) return fail(400, GENERIC.badRequest)

  const ip = clientIp(context)

  // A 429 here does not undo the "same answer either way" rule. It is keyed on
  // the address as typed, so an address with an account and one without hit the
  // limit identically, and neither learns anything from the other's behaviour.
  if (ip) {
    const byIp = await take('forgot-ip', ip, RATE_LIMITS.forgot)
    if (!byIp.allowed) {
      return refuseTooMany(byIp, { ip, actorEmail: body.email, detail: 'reset requests from one address' })
    }
  }
  const byAccount = await take('forgot-account', body.email, RATE_LIMITS.forgot)
  if (!byAccount.allowed) {
    return refuseTooMany(byAccount, { ip, actorEmail: body.email, detail: 'reset requests for one account' })
  }

  const user = await getUserByEmail(body.email)

  if (!user || user.status !== 'active') {
    await record({
      action: 'password_reset_requested',
      result: 'failure',
      actorEmail: body.email,
      ip,
      detail: user ? `no active account, status is ${user.status}` : 'no account for that address',
    })
    return json(SAME_ANSWER)
  }

  // A new request kills any link already outstanding, so a forwarded email from
  // last week stops working the moment someone asks for another.
  await revokeTokensFor(user.email, 'reset')
  const { token, invitation } = await issueToken({
    email: user.email,
    role: user.role,
    purpose: 'reset',
    invitedBy: user.id,
  })

  await deliver({
    kind: 'reset',
    email: user.email,
    token,
    expiresAt: invitation.expiresAt,
  })

  await record({
    action: 'password_reset_requested',
    result: 'success',
    actorId: user.id,
    actorEmail: user.email,
    ip,
    detail: `reset token issued, expires ${invitation.expiresAt}`,
  })

  return json(SAME_ANSWER)
}

export const config: Config = { path: '/api/auth/forgot' }
