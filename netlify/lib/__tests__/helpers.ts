import type { Context } from '@netlify/functions'
import { hashPassword } from '../password'
import type { RoleT, UserStatusT, UserT } from '../schema'
import { createUser, saveUser } from '../users'

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

/** The cookie a browser would send back, taken from a response's Set-Cookie. */
export function cookieFrom(res: Response): string {
  const setCookie = res.headers.get('set-cookie')
  if (!setCookie) throw new Error('That response set no cookie')
  return setCookie.split(';')[0]
}

export function signedIn(res: Response): Record<string, string> {
  return { cookie: cookieFrom(res) }
}

export async function seedUser(input: {
  email: string
  password?: string
  name?: string
  role?: RoleT
  status?: UserStatusT
}): Promise<UserT> {
  const user = await createUser({
    email: input.email,
    name: input.name ?? 'Test Person',
    role: input.role ?? 'member',
  })
  const status = input.status ?? (input.password ? 'active' : 'invited')
  return saveUser({
    ...user,
    status,
    passwordHash: input.password ? await hashPassword(input.password) : user.passwordHash,
  })
}
