import type { Config, Context } from '@netlify/functions'
import ledger from '../../data/polyco-ledger.json' with { type: 'json' }
import statements from '../../data/monthly-funding-statements.json' with { type: 'json' }
import { authenticate, clientIp, json, refuseUnauthenticated, wrongMethod } from '../lib/http'

/**
 * The figures, behind the session.
 *
 * They used to be imported straight into `src/App.tsx`, which compiled the whole
 * Polyco ledger into the public JavaScript bundle. Anyone who fetched that file
 * had every row without signing in, and no amount of guarding in the interface
 * could have helped: Netlify serves a static asset before any of our code runs.
 *
 * Importing them here instead puts them inside the function bundle, which is not
 * public, and the only way out is through this handler.
 *
 * Both files are already validated against their schemas at build time by
 * `scripts/validate-data.ts`, and parsed again by Zod when the interface receives
 * them. There is nothing useful for this handler to add in between, so it does
 * not parse them a third time on every request.
 *
 * Not audited. AUTH-SPEC section 7 asks for exports and downloads to be logged,
 * and this is neither: it is the page loading. Logging every refresh would bury
 * the deliberate exports that the entry is meant to catch. Tab 8's export gets
 * its own entry when it is built.
 */
export default async (req: Request, context: Context) => {
  const badMethod = wrongMethod(req, 'GET')
  if (badMethod) return badMethod

  const authed = await authenticate(req)
  if (!authed) return refuseUnauthenticated(req, clientIp(context))

  return json({ ledger, statements })
}

export const config: Config = { path: '/api/data' }
