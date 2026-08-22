import type { Config, Context } from '@netlify/functions'
import {
  authenticate,
  clientIp,
  json,
  publicUser,
  refuseUnauthenticated,
  wrongMethod,
} from '../lib/http'
import { listUsers } from '../lib/users'

/**
 * Everyone signed in can see who else is here, per AUTH-SPEC section 5. That is
 * the transparent basis the whole dashboard runs on: Polyco can see who at
 * EcoFibre has access, and EcoFibre can see who at Polyco does.
 *
 * publicUser() decides what leaves. No password hash, no failed attempt counts,
 * no lockout state, and no pay data of any kind.
 */
export default async (req: Request, context: Context) => {
  const badMethod = wrongMethod(req, 'GET')
  if (badMethod) return badMethod

  const authed = await authenticate(req)
  if (!authed) return refuseUnauthenticated(req, clientIp(context))

  return json({ users: (await listUsers()).map(publicUser) })
}

export const config: Config = { path: '/api/users' }
