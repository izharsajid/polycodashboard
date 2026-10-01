import type { Config } from '@netlify/functions'
import plan from '../../data/machine-plan.json' with { type: 'json' }
import { json, wrongMethod } from '../lib/http'

/** The forming machine plan. What each machine runs now comes live from /api/tracker. */
export default async (req: Request) => {
  const badMethod = wrongMethod(req, 'GET')
  if (badMethod) return badMethod
  return json({ plan }, 200, { 'x-robots-tag': 'noindex, nofollow' })
}

export const config: Config = { path: '/api/machines' }
