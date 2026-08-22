import type { Context } from '@netlify/functions'
import type { z } from 'zod'
import type { RoleT, SessionT, UserStatusT, UserT } from './schema'
import { destroySession, readSessionCookie, resolveSession } from './sessions'
import { getUser } from './users'

/**
 * What every endpoint says to the outside world, and how it decides who is
 * asking. AUTH-SPEC section 9: errors returned to the caller are generic, detail
 * goes to the log, and every state-changing endpoint verifies the session server
 * side.
 */

const JSON_HEADERS: Record<string, string> = {
  'content-type': 'application/json; charset=utf-8',
  // Nothing here is cacheable and some of it is a session. Say so explicitly
  // rather than trusting every proxy in between to work it out.
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
}

export function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...JSON_HEADERS, ...extra } })
}

export function fail(status: number, error: string, extra: Record<string, string> = {}): Response {
  return json({ error }, status, extra)
}

/**
 * The only messages a caller gets. They are deliberately incurious: a sign-in
 * that fails says the same thing whether the address is unknown, the password is
 * wrong, the account was never activated, or it has been locked. Anything more
 * helpful is also more helpful to somebody working out who has an account here.
 */
export const GENERIC = {
  badRequest: 'That request could not be read.',
  signIn: 'Those sign-in details were not accepted.',
  session: 'Sign in to continue.',
  role: 'You do not have access to that.',
  link: 'That link is no longer valid. Ask for a new one.',
  method: 'That method is not allowed here.',
} as const

export async function readBody<T extends z.ZodTypeAny>(
  req: Request,
  schema: T,
): Promise<z.infer<T> | null> {
  try {
    const parsed = schema.safeParse(await req.json())
    return parsed.success ? parsed.data : null
  } catch {
    // Malformed JSON and a failed schema check are the same answer to the caller.
    return null
  }
}

/** Functions declare a path, not a method, so each one checks its own. */
export function wrongMethod(req: Request, allowed: string): Response | null {
  if (req.method === allowed) return null
  return fail(405, GENERIC.method, { allow: allowed })
}

export function clientIp(context: Pick<Context, 'ip'>): string | null {
  return context.ip ? context.ip.slice(0, 64) : null
}

export type Authenticated = { user: UserT; session: SessionT; token: string }

/**
 * Cookie to session to user, or null. Null covers no cookie, an unknown cookie,
 * an expired session and a user who is no longer active, and the caller cannot
 * tell which, because it should not be able to.
 *
 * A deactivated user stops here rather than when their cookie happens to expire.
 * Deactivation that takes effect in twelve hours is not deactivation.
 */
export async function authenticate(req: Request): Promise<Authenticated | null> {
  const token = readSessionCookie(req.headers.get('cookie'))
  if (!token) return null

  const session = await resolveSession(token)
  if (!session) return null

  const user = await getUser(session.userId)
  if (!user || user.status !== 'active') {
    await destroySession(token)
    return null
  }
  return { user, session, token }
}

/**
 * AUTH-SPEC section 8: hiding a link in the interface is not access control.
 * Every administrator endpoint calls this, every time, after authenticate().
 */
export function forbiddenUnlessAdmin(authed: Authenticated): Response | null {
  return authed.user.role === 'admin' ? null : fail(403, GENERIC.role)
}

export type PublicUser = {
  id: string
  email: string
  name: string
  role: RoleT
  status: UserStatusT
  createdAt: string
  lastLoginAt: string | null
}

/**
 * Built by naming every field that may leave, never by copying the record and
 * deleting what must not. A spread with omissions leaks the next field somebody
 * adds, which is the same reasoning the old partner whitelist rested on and the
 * one part of it worth keeping.
 */
export function publicUser(user: UserT): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  }
}
