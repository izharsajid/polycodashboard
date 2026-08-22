import type { Config, Context } from '@netlify/functions'
import { z } from 'zod'
import { record } from '../lib/audit'
import { deliver } from '../lib/delivery'
import {
  GENERIC,
  authenticate,
  clientIp,
  fail,
  json,
  publicUser,
  readBody,
  wrongMethod,
} from '../lib/http'
import { mayInvite, type InviteRefusal } from '../lib/invite-policy'
import { issueToken, revokeTokensFor } from '../lib/invitations'
import { Email, Role } from '../lib/schema'
import { createUser, getUserByEmail, saveUser } from '../lib/users'

const Body = z.object({
  email: Email,
  name: z.string().trim().min(1).max(120),
  role: Role.optional(),
})

/**
 * A refusal the inviter can act on. These are not the generic messages: the
 * caller is a signed-in colleague, `/api/users` already lists everybody, and
 * "that was refused" with no reason produces a support conversation rather than a
 * corrected address.
 */
const REFUSAL: Record<InviteRefusal, string> = {
  domain_not_permitted:
    'Invitations can only go to polycohealthline.com or ecofibre.bh addresses.',
  not_your_domain: 'You can invite colleagues at your own domain. Ask an administrator for anyone else.',
  members_cannot_appoint_administrators: 'Only an administrator can invite another administrator.',
  inviter_not_active: GENERIC.role,
}

export default async (req: Request, context: Context) => {
  const badMethod = wrongMethod(req, 'POST')
  if (badMethod) return badMethod

  const authed = await authenticate(req)
  if (!authed) return fail(401, GENERIC.session)

  const body = await readBody(req, Body)
  if (!body) return fail(400, GENERIC.badRequest)

  const ip = clientIp(context)
  const inviter = authed.user

  const decision = mayInvite(inviter, body.email, body.role)
  if (!decision.allowed) {
    await record({
      action: 'invitation_refused_domain',
      result: 'failure',
      actorId: inviter.id,
      actorEmail: inviter.email,
      target: body.email,
      ip,
      detail: decision.reason,
    })
    return fail(403, REFUSAL[decision.reason])
  }

  const existing = await getUserByEmail(body.email)
  if (existing?.status === 'active') {
    return fail(409, 'That address already has an account.')
  }
  if (existing?.status === 'deactivated') {
    return fail(409, 'That account was deactivated. An administrator can reactivate it.')
  }

  // Either a fresh account, or one that was invited before and never accepted.
  // Re-inviting kills the previous link, so only the newest one works.
  const user =
    existing ??
    (await createUser({
      email: body.email,
      name: body.name,
      role: decision.role,
      status: 'invited',
      createdBy: inviter.id,
    }))

  if (existing) {
    await saveUser({ ...existing, name: body.name, role: decision.role })
    await revokeTokensFor(user.email, 'invitation')
  }

  const { token, invitation } = await issueToken({
    email: user.email,
    role: decision.role,
    purpose: 'invitation',
    invitedBy: inviter.id,
  })

  // Goes nowhere until sending is switched on. See netlify/lib/delivery.ts.
  await deliver({
    kind: 'invitation',
    email: user.email,
    token,
    expiresAt: invitation.expiresAt,
  })

  await record({
    action: 'invitation_sent',
    result: 'success',
    actorId: inviter.id,
    actorEmail: inviter.email,
    target: user.email,
    ip,
    detail: `invited as ${decision.role}, link expires ${invitation.expiresAt}`,
  })

  return json({ user: publicUser({ ...user, name: body.name, role: decision.role }) }, 201)
}

export const config: Config = { path: '/api/users/invite' }
