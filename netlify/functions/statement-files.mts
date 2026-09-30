import type { Config, Context } from '@netlify/functions'
import { record } from '../lib/audit'
import { ALLOWED_DESCRIPTION, getDocument, MAX_FILE_BYTES, readDocumentBytes, saveDocument, sniff } from '../lib/documents'
import { requireEditor } from '../lib/editor'
import { clientIp, fail, json } from '../lib/http'
import { orderIdFor, TARGET } from '../lib/statement-store'

/**
 * Files on the statement: an invoice for a cargo clearance line, a remittance
 * for a payment, anything that supports a figure.
 *
 *   POST /api/statement/files?target=row-81   multipart: file   (signed in)
 *   GET  /api/statement/files?id=...&action=view|download          (anyone)
 *
 * The type is read from the file's own bytes, never its name, and the stored
 * name is only ever shown, never used as a path.
 */
export default async (req: Request, context: Context) => {
  const url = new URL(req.url)

  if (req.method === 'GET') {
    const id = url.searchParams.get('id') ?? ''
    if (!/^[A-Za-z0-9_-]{1,60}$/.test(id)) return fail(400, 'That file reference is not valid.')
    const meta = await getDocument(id)
    if (!meta || meta.deletedAt || !meta.orderId.startsWith('stmt:')) return fail(404, 'No file has that reference.')
    const base64 = await readDocumentBytes(meta)
    if (!base64) return fail(404, 'That file could not be found.')
    const download = url.searchParams.get('action') === 'download'
    return new Response(Buffer.from(base64, 'base64'), {
      headers: {
        'content-type': meta.contentType,
        'content-disposition': `${download ? 'attachment' : 'inline'}; filename="${meta.filename.replace(/"/g, '')}"`,
        'cache-control': 'private, max-age=300',
        'x-content-type-options': 'nosniff',
        'x-robots-tag': 'noindex, nofollow',
      },
    })
  }

  if (req.method !== 'POST') return fail(405, 'Use GET to read a file or POST to upload one.')
  const gate = await requireEditor(req)
  if ('refused' in gate) return gate.refused
  const editor = gate.authed.user

  const target = url.searchParams.get('target') ?? ''
  if (!TARGET.test(target)) return fail(400, 'Say which line, entry or PO the file belongs to.')

  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  const by = editor.name
  if (!(file instanceof File)) return fail(400, 'Choose a file to upload.')
  if (file.size === 0 || file.size > MAX_FILE_BYTES) return fail(413, `Files must be under ${MAX_FILE_BYTES / 1024 / 1024} MB.`)

  const bytes = new Uint8Array(await file.arrayBuffer())
  const kind = sniff(bytes, file.name)
  if (!kind.ok) return fail(415, `That file type is not accepted. Upload a ${ALLOWED_DESCRIPTION} file.`)

  const meta = await saveDocument({
    orderId: orderIdFor(target),
    group: 'delivery',
    filename: file.name.slice(0, 255) || 'file',
    bytes,
    contentType: kind.contentType,
    uploadedBy: by,
    uploadedByEmail: editor.email,
  })
  await record({
    action: 'document_uploaded',
    result: 'success',
    target: `statement:${target}`,
    detail: `${by} uploaded ${meta.filename} (${meta.size} bytes)`,
    ip: clientIp(context),
  })
  return json(
    { file: { id: meta.id, target, filename: meta.filename, contentType: meta.contentType, size: meta.size, uploadedBy: by, uploadedAt: meta.uploadedAt } },
    201,
  )
}

export const config: Config = { path: '/api/statement/files' }
