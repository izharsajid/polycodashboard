import type { Config } from '@netlify/functions'
import { z } from 'zod'
import { GENERIC, fail, json, readBody, wrongMethod } from '../lib/http'
import { readToken } from '../lib/invitations'

const Body = z.object({ token: z.string().min(1).max(200) })

/**
 * The invitation page asking who this link is for.
 *
 * POST, although it only reads, because the token travels in the body. In a path
 * it would be in Netlify's access log and in browser history, which section 9
 * forbids.
 *
 * Returns the email and nothing else, per AUTH-SPEC section 5. Not the name, not
 * the role, not who did the inviting. Whoever holds the link should learn the
 * least the page can work with.
 */
export default async (req: Request) => {
  const badMethod = wrongMethod(req, 'POST')
  if (badMethod) return badMethod

  const body = await readBody(req, Body)
  if (!body) return fail(400, GENERIC.badRequest)

  const held = await readToken(body.token, 'invitation')
  if (!held.ok) return fail(410, GENERIC.link)

  return json({ email: held.invitation.email })
}

export const config: Config = { path: '/api/invitations/validate' }
