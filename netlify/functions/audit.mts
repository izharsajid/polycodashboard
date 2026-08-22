import type { Config } from '@netlify/functions'
import { z } from 'zod'
import { pageAudit } from '../lib/audit'
import { GENERIC, authenticate, fail, forbiddenUnlessAdmin, json, wrongMethod } from '../lib/http'
import { AuditAction } from '../lib/schema'

/**
 * Administrators only, per AUTH-SPEC section 5.
 *
 * Read only, and there is no counterpart that writes or deletes. The log is
 * append only and the only way in is record(), from the endpoint doing the thing
 * being recorded.
 */
const Query = z.object({
  action: AuditAction.optional(),
  actorId: z.string().min(1).max(100).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().optional(),
  cursor: z.string().min(1).max(200).optional(),
})

export default async (req: Request) => {
  const badMethod = wrongMethod(req, 'GET')
  if (badMethod) return badMethod

  const authed = await authenticate(req)
  if (!authed) return fail(401, GENERIC.session)

  const notAdmin = forbiddenUnlessAdmin(authed)
  if (notAdmin) return notAdmin

  const params = Object.fromEntries(new URL(req.url).searchParams)
  const query = Query.safeParse(params)
  if (!query.success) return fail(400, GENERIC.badRequest)

  return json(await pageAudit(query.data))
}

export const config: Config = { path: '/api/audit' }
