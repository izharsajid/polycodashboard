import type { Config } from '@netlify/functions'
import disputes from '../../data/ledger-disputes.json' with { type: 'json' }
import ledger from '../../data/polyco-ledger.json' with { type: 'json' }
import { json, wrongMethod } from '../lib/http'

/**
 * The PHL/EcoFibre ledger and its disputed dates, for the Statement tab. Open to
 * anyone with the address, like /api/data, with no-store and noindex.
 * Validated at build time by `scripts/validate-data.ts` and again on receipt.
 */
export default async (req: Request) => {
  const badMethod = wrongMethod(req, 'GET')
  if (badMethod) return badMethod

  return json({ ledger, disputes }, 200, { 'x-robots-tag': 'noindex, nofollow' })
}

export const config: Config = { path: '/api/ledger' }
