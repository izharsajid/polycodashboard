import type { Config, Context } from '@netlify/functions'
import { record } from '../lib/audit'
import { authenticate, clientIp, json, wrongMethod } from '../lib/http'
import { clearedSessionCookie, destroySession } from '../lib/sessions'

/**
 * Always clears the cookie and always returns 200, signed in or not. Refusing to
 * sign out somebody who is already signed out helps nobody, and the browser
 * should be told to drop the cookie either way.
 */
export default async (req: Request, context: Context) => {
  const badMethod = wrongMethod(req, 'POST')
  if (badMethod) return badMethod

  const authed = await authenticate(req)
  if (authed) {
    await destroySession(authed.token)
    await record({
      action: 'sign_out',
      result: 'success',
      actorId: authed.user.id,
      actorEmail: authed.user.email,
      ip: clientIp(context),
    })
  }

  return json({ ok: true }, 200, { 'set-cookie': clearedSessionCookie() })
}

export const config: Config = { path: '/api/auth/logout' }
