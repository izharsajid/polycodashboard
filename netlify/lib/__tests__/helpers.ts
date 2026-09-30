import type { Context } from '@netlify/functions'
import type { RoleT, UserStatusT, UserT } from '../schema'
import { createSession, sessionCookie } from '../sessions'
import { createUser, getUserByEmail, saveUser } from '../users'

/**
 * A Netlify v2 function is a plain (Request, Context) => Response, so the tests
 * call the real handler with a real Request and read a real Response. Nothing is
 * mocked except the datastore and the delivery of links.
 */
export function ctx(ip = '203.0.113.7'): Context {
  return { ip, params: {}, log: () => {} } as unknown as Context
}

export function post(path: string, body: unknown, headers: Record<string, string> = {}): Request {
  return new Request(`https://dashboard.ecofibre.bh${path}`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json', ...headers },
  })
}

export function get(path: string, headers: Record<string, string> = {}): Request {
  return new Request(`https://dashboard.ecofibre.bh${path}`, { method: 'GET', headers })
}

/**
 * An account for the endpoints that still check for a session (the Orderbook's
 * orders and documents). There is no sign-in any more, so the hash is a stand-in:
 * nothing ever verifies it.
 */
export async function seedUser(input: {
  email: string
  name?: string
  role?: RoleT
  status?: UserStatusT
}): Promise<UserT> {
  const user = await createUser({
    email: input.email,
    name: input.name ?? 'Test Person',
    role: input.role ?? 'member',
  })
  const status = input.status ?? 'active'
  return saveUser({ ...user, status, passwordHash: status === 'active' ? 'test-only' : user.passwordHash })
}

/** The cookie headers of a fresh session for an account already seeded. */
export async function sessionFor(email: string): Promise<Record<string, string>> {
  const user = await getUserByEmail(email)
  if (!user) throw new Error(`No account for ${email}`)
  const { token } = await createSession({ userId: user.id })
  return { cookie: sessionCookie(token).split(';')[0] }
}
