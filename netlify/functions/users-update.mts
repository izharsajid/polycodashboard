import type { Config, Context } from '@netlify/functions'
import { z } from 'zod'
import { record } from '../lib/audit'
import {
  GENERIC,
  authenticate,
  clientIp,
  fail,
  json,
  publicUser,
  readBody,
  refuseUnauthenticated,
  refuseUnlessAdmin,
  wrongMethod,
} from '../lib/http'
import { Role } from '../lib/schema'
import { revokeUserSessions } from '../lib/sessions'
import { getUser, saveUser } from '../lib/users'

const Body = z
  .object({
    role: Role.optional(),
    deactivated: z.boolean().optional(),
  })
  .refine((b) => b.role !== undefined || b.deactivated !== undefined, {
    message: 'nothing to change',
  })

export default async (req: Request, context: Context) => {
  const badMethod = wrongMethod(req, 'PATCH')
  if (badMethod) return badMethod

  const ip = clientIp(context)

  const authed = await authenticate(req)
  if (!authed) return refuseUnauthenticated(req, ip)

  const notAdmin = await refuseUnlessAdmin(req, authed, ip)
  if (notAdmin) return notAdmin

  const body = await readBody(req, Body)
  if (!body) return fail(400, GENERIC.badRequest)

  const target = await getUser(context.params.id ?? '')
  if (!target) return fail(404, 'There is no such user.')

  /**
   * An administrator cannot change their own role or deactivate themselves.
   *
   * Partly because neither is a thing anyone means to do, and partly because it
   * is what keeps the last administrator from disappearing: with self-changes
   * refused, removing an administrator always takes a second one who is still an
   * administrator afterwards, so the count can never reach zero.
   */
  if (target.id === authed.user.id) {
    return fail(403, 'You cannot change your own role or deactivate your own account.')
  }

  let updated = target

  if (body.role !== undefined && body.role !== target.role) {
    updated = { ...updated, role: body.role }
    await record({
      action: 'role_changed',
      result: 'success',
      actorId: authed.user.id,
      actorEmail: authed.user.email,
      target: target.email,
      ip,
      detail: `${target.role} to ${body.role}`,
    })
  }

  if (body.deactivated === true && target.status !== 'deactivated') {
    updated = { ...updated, status: 'deactivated' }
    await record({
      action: 'user_deactivated',
      result: 'success',
      actorId: authed.user.id,
      actorEmail: authed.user.email,
      target: target.email,
      ip,
      detail: `was ${target.status}`,
    })
  }

  if (body.deactivated === false && target.status === 'deactivated') {
    // Back to where they were. Somebody who never accepted their invitation
    // returns to invited, not to active: they still have no password, and an
    // active account without one is a contradiction the schema refuses anyway.
    const restored = target.passwordHash ? 'active' : 'invited'
    updated = { ...updated, status: restored }
    await record({
      action: 'user_reactivated',
      result: 'success',
      actorId: authed.user.id,
      actorEmail: authed.user.email,
      target: target.email,
      ip,
      detail: `restored to ${restored}`,
    })
  }

  const saved = await saveUser(updated)

  // Deactivation takes effect now, not whenever their cookie happens to lapse.
  // authenticate() would refuse them on the next request in any case; this also
  // clears the records so nothing is left to go stale.
  if (saved.status === 'deactivated') await revokeUserSessions(saved.id)

  return json({ user: publicUser(saved) })
}

/**
 * excludedPath is not decoration. `/api/users/:id` matches `/api/users/invite`
 * too, and it wins, so without this the invite endpoint is unreachable and
 * answers 405 instead. Verified against a running server rather than assumed.
 */
export const config: Config = {
  path: '/api/users/:id',
  excludedPath: '/api/users/invite',
}
