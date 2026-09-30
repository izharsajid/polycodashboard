import type { Config } from '@netlify/functions'
import { GENERIC, authenticate, fail, json, publicUser, wrongMethod } from '../lib/http'

/** Who the caller is, according to the server rather than according to the page. */
export default async (req: Request) => {
  const badMethod = wrongMethod(req, 'GET')
  if (badMethod) return badMethod

  const authed = await authenticate(req)
  if (!authed) return fail(401, GENERIC.session)

  return json({ user: publicUser(authed.user) })
}

export const config: Config = { path: '/api/auth/me' }
