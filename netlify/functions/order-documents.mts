import type { Config, Context } from '@netlify/functions'
import tracker from '../../data/po-tracker.json' with { type: 'json' }
import { record } from '../lib/audit'
import { RATE_LIMITS } from '../lib/config'
import {
  DocumentGroup, MAX_FILES_PER_ORDER, MAX_FILE_BYTES,
  listDocuments, saveDocument, sniff,
} from '../lib/documents'
import {
  GENERIC, authenticate, clientIp, fail, json, refuseTooMany, refuseUnauthenticated, wrongMethod,
} from '../lib/http'
import { take } from '../lib/rate-limit'

/**
 * Uploading a document against an order.
 *
 * Any signed-in user, EcoFibre or Polyco, per section 4. Polyco holding their own
 * copy of a bill of lading against the same order is what makes a reconciliation
 * call short.
 */
export default async (req: Request, context: Context) => {
  const badMethod = wrongMethod(req, 'POST')
  if (badMethod) return badMethod

  const ip = clientIp(context)
  const authed = await authenticate(req)
  if (!authed) return refuseUnauthenticated(req, ip)

  const allowance = await take('upload-user', authed.user.id, RATE_LIMITS.upload)
  if (!allowance.allowed) {
    return refuseTooMany(allowance, {
      actorId: authed.user.id,
      actorEmail: authed.user.email,
      ip,
      detail: 'document uploads by one person',
    })
  }

  const orderId = context.params.id?.trim()
  if (!orderId) return fail(400, GENERIC.badRequest)
  if (!tracker.orders.some((o) => o.po_number === orderId)) {
    return fail(404, 'There is no such order.')
  }

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return fail(400, GENERIC.badRequest)
  }

  const file = form.get('file')
  const group = DocumentGroup.safeParse(form.get('group'))
  if (!(file instanceof File) || !group.success) return fail(400, GENERIC.badRequest)

  if (file.size > MAX_FILE_BYTES) {
    return fail(413, `That file is larger than ${MAX_FILE_BYTES / (1024 * 1024)} MB.`)
  }

  const existing = (await listDocuments(orderId)).filter((d) => d.deletedAt === null)
  if (existing.length >= MAX_FILES_PER_ORDER) {
    return fail(409, `This order already has ${MAX_FILES_PER_ORDER} documents.`)
  }

  const bytes = new Uint8Array(await file.arrayBuffer())
  // Checked again on the server against the real size, because a client-side
  // check is a courtesy and not a control.
  if (bytes.length > MAX_FILE_BYTES) {
    return fail(413, `That file is larger than ${MAX_FILE_BYTES / (1024 * 1024)} MB.`)
  }

  // What it is, from its bytes. Never from the name or the declared type.
  const kind = sniff(bytes, file.name)
  if (!kind.ok) {
    await record({
      action: 'document_uploaded',
      result: 'failure',
      actorId: authed.user.id,
      actorEmail: authed.user.email,
      target: orderId,
      ip,
      detail: `rejected: ${kind.reason}`,
    })
    return fail(415, kind.reason)
  }

  const meta = await saveDocument({
    orderId,
    group: group.data,
    filename: file.name.slice(0, 255),
    bytes,
    contentType: kind.contentType,
    uploadedBy: authed.user.id,
    uploadedByEmail: authed.user.email,
  })

  await record({
    action: 'document_uploaded',
    result: 'success',
    actorId: authed.user.id,
    actorEmail: authed.user.email,
    target: `${orderId}/${meta.id}`,
    ip,
    detail: `${meta.filename}, ${meta.contentType}, ${meta.size} bytes, ${meta.group}`,
  })

  return json({ document: meta }, 201)
}

export const config: Config = { path: '/api/orders/:id/documents' }
