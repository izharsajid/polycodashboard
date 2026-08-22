import type { Config, Context } from '@netlify/functions'
import { record } from '../lib/audit'
import { getDocument, readDocumentBytes, softDeleteDocument } from '../lib/documents'
import {
  GENERIC, authenticate, clientIp, fail, json, refuseUnauthenticated, refuseUnlessAdmin,
} from '../lib/http'

/**
 * Serving a document, and soft-deleting one.
 *
 * Section 4: no public URL, and no signed link that outlives the session. Every
 * byte goes through this handler with the session checked first, which is the
 * same failure the ledger had when it sat in the JavaScript bundle.
 */
export default async (req: Request, context: Context) => {
  const ip = clientIp(context)

  if (req.method !== 'GET' && req.method !== 'DELETE') {
    return fail(405, GENERIC.method, { allow: 'GET, DELETE' })
  }

  const authed = await authenticate(req)
  if (!authed) return refuseUnauthenticated(req, ip)

  const id = context.params.id?.trim()
  if (!id) return fail(400, GENERIC.badRequest)

  const meta = await getDocument(id)
  if (!meta) return fail(404, 'There is no such document.')

  if (req.method === 'DELETE') {
    const notAdmin = await refuseUnlessAdmin(req, authed, ip)
    if (notAdmin) return notAdmin

    if (meta.deletedAt !== null) return json({ document: meta })

    const deleted = await softDeleteDocument(meta, {
      id: authed.user.id,
      email: authed.user.email,
    })
    await record({
      action: 'document_deleted',
      result: 'success',
      actorId: authed.user.id,
      actorEmail: authed.user.email,
      target: `${meta.orderId}/${meta.id}`,
      ip,
      detail: `${meta.filename}, marked deleted and still retrievable`,
    })
    return json({ document: deleted })
  }

  const base64 = await readDocumentBytes(meta)
  if (base64 === null) return fail(404, 'That document is no longer stored.')

  // `download` chooses the disposition. Viewing and downloading are different
  // acts and section 4 asks for both to be logged, separately.
  const download = new URL(req.url).searchParams.get('download') === '1'

  await record({
    action: download ? 'document_downloaded' : 'document_viewed',
    result: 'success',
    actorId: authed.user.id,
    actorEmail: authed.user.email,
    target: `${meta.orderId}/${meta.id}`,
    ip,
    detail: `${meta.filename}${meta.deletedAt ? ', deleted copy' : ''}`,
  })

  const bytes = Buffer.from(base64, 'base64')
  // The filename is quoted and stripped of anything that could break out of the
  // header. It came from an uploader and is still not trusted here.
  const safeName = meta.filename.replace(/["\\\r\n]/g, '_')

  return new Response(bytes, {
    status: 200,
    headers: {
      'content-type': meta.contentType,
      'content-length': String(bytes.length),
      'content-disposition': `${download ? 'attachment' : 'inline'}; filename="${safeName}"`,
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    },
  })
}

export const config: Config = { path: '/api/documents/:id' }
