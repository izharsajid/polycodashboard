import type { Config } from '@netlify/functions'
import { MasterUnavailable, readTracker } from '../lib/efdashboard'
import { fail, json, wrongMethod } from '../lib/http'

/** efdashboard.com's PO tracker, live, for the PO tracker and statement tabs. */
export default async (req: Request) => {
  const badMethod = wrongMethod(req, 'GET')
  if (badMethod) return badMethod
  try {
    return json(await readTracker(), 200, { 'x-robots-tag': 'noindex, nofollow' })
  } catch (error) {
    const why = error instanceof MasterUnavailable ? error.message : 'the request failed'
    return fail(502, `efdashboard.com could not be read just now (${why}). Try again in a moment.`)
  }
}

export const config: Config = { path: '/api/tracker' }
