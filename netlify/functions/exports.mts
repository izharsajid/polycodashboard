import type { Config, Context } from '@netlify/functions'
import { z } from 'zod'
import { record } from '../lib/audit'
import {
  GENERIC, authenticate, clientIp, fail, json, readBody, refuseUnauthenticated, wrongMethod,
} from '../lib/http'

const Body = z.object({
  format: z.enum(['csv', 'xlsx']),
  from: z.string().max(20).nullable(),
  to: z.string().max(20).nullable(),
  columns: z.array(z.string().max(40)).max(40),
  rows: z.number().int().min(0),
})

/**
 * Records that a statement was exported. AUTH-SPEC section 7 asks for exports to
 * be logged, and this is the first one that exists.
 *
 * The interface calls this **before** it builds the file and refuses to export if
 * it fails, so the log is the authority on what left rather than a note the
 * client may or may not have got round to sending.
 *
 * It deliberately does not carry any figure. Who, when, what range, which
 * columns, how many rows. The numbers are already on the page for anyone with a
 * session; what the log is for is knowing who took a copy away.
 */
export default async (req: Request, context: Context) => {
  const badMethod = wrongMethod(req, 'POST')
  if (badMethod) return badMethod

  const ip = clientIp(context)

  const authed = await authenticate(req)
  if (!authed) return refuseUnauthenticated(req, ip)

  const body = await readBody(req, Body)
  if (!body) return fail(400, GENERIC.badRequest)

  const period = body.from || body.to ? `${body.from ?? 'start'} to ${body.to ?? 'latest'}` : 'all'

  await record({
    action: 'export_downloaded',
    result: 'success',
    actorId: authed.user.id,
    actorEmail: authed.user.email,
    target: 'statement',
    ip,
    detail: `${body.format.toUpperCase()}, ${period}, ${body.rows} rows, columns: ${body.columns.join(' ')}`,
  })

  return json({ ok: true })
}

export const config: Config = { path: '/api/exports' }
