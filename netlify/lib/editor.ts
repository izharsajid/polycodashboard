import { authenticate, type Authenticated } from './http'
import { fail } from './http'

/**
 * Who may change the statement: anyone signed in. Reading stays open to anyone
 * with the address. Each change is stamped on the server with the signed-in
 * account's name, never a name the page sends.
 */
export async function requireEditor(req: Request): Promise<{ authed: Authenticated } | { refused: Response }> {
  const authed = await authenticate(req)
  if (!authed) return { refused: fail(401, 'Sign in to make changes.') }
  return { authed }
}
