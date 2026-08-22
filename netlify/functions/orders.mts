import type { Config, Context } from '@netlify/functions'
import tracker from '../../data/po-tracker.json' with { type: 'json' }
import { listDocuments } from '../lib/documents'
import {
  authenticate, clientIp, fail, json, refuseUnauthenticated, wrongMethod,
} from '../lib/http'

/**
 * The tracker, and one order with its documents.
 *
 * Two paths in one function, because `/api/orders/:id` would otherwise shadow
 * `/api/orders` the way `/api/users/:id` shadowed `/api/users/invite`. One handler
 * cannot collide with itself.
 */
export default async (req: Request, context: Context) => {
  const badMethod = wrongMethod(req, 'GET')
  if (badMethod) return badMethod

  const authed = await authenticate(req)
  if (!authed) return refuseUnauthenticated(req, clientIp(context))

  const id = context.params.id?.trim()
  if (!id) return json({ tracker })

  const order = tracker.orders.find((o) => o.po_number === id)
  if (!order) return fail(404, 'There is no such order.')

  // Soft-deleted documents are returned with their deletion recorded rather than
  // omitted. Section 4: the file stays retrievable and the record stays complete.
  return json({ order, documents: await listDocuments(id) })
}

export const config: Config = { path: ['/api/orders', '/api/orders/:id'] }
