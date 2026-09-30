import type { Config } from '@netlify/functions'
import funds from '../../data/funds-requested.json' with { type: 'json' }
import { json, wrongMethod } from '../lib/http'

/**
 * The statements, open to anyone with the address.
 *
 * Sign-in was removed on 1 October 2026 at Izhar's direction, so this answers
 * without a session. It still sends `no-store`, so no cache between here and the
 * reader keeps a copy, and `X-Robots-Tag: noindex` so a crawler that finds it
 * does not list it.
 *
 * The file is validated against its schema at build time by
 * `scripts/validate-data.ts`, and parsed again by Zod when the page receives it.
 */
export default async (req: Request) => {
  const badMethod = wrongMethod(req, 'GET')
  if (badMethod) return badMethod

  return json({ funds }, 200, { 'x-robots-tag': 'noindex, nofollow' })
}

export const config: Config = { path: '/api/data' }
