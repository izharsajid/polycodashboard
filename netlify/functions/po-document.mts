import type { Config } from '@netlify/functions'
import { EFDASHBOARD } from '../lib/efdashboard'
import { fail, wrongMethod } from '../lib/http'

/**
 * A PO file from efdashboard.com, viewed or downloaded through this site.
 *
 *   GET /api/po-document?po=2679713&file=CI-2679713.pdf&action=view
 *
 * Only ever fetches from efdashboard.com's own /api/po-documents, with the PO
 * and filename checked first, so this cannot be pointed anywhere else.
 */
const PO = /^[A-Za-z0-9-]{1,40}$/
const FILE = /^[\w .()+,&'-]{1,200}$/

export default async (req: Request) => {
  const badMethod = wrongMethod(req, 'GET')
  if (badMethod) return badMethod

  const url = new URL(req.url)
  const po = url.searchParams.get('po') ?? ''
  const file = url.searchParams.get('file') ?? ''
  const action = url.searchParams.get('action') === 'download' ? 'download' : 'view'
  if (!PO.test(po) || !FILE.test(file) || file.includes('..')) return fail(400, 'That file reference is not valid.')

  const source = new URL('/api/po-documents', EFDASHBOARD)
  source.searchParams.set('po', po)
  source.searchParams.set('file', file)
  source.searchParams.set('action', action)

  const res = await fetch(source, { cache: 'no-store' })
  if (!res.ok || !res.body) return fail(res.status === 404 ? 404 : 502, 'efdashboard.com could not supply that file.')

  const headers = new Headers({
    'content-type': res.headers.get('content-type') ?? 'application/octet-stream',
    'content-disposition': `${action === 'download' ? 'attachment' : 'inline'}; filename="${file.replace(/"/g, '')}"`,
    'cache-control': 'private, max-age=300',
    'x-content-type-options': 'nosniff',
    'x-robots-tag': 'noindex, nofollow',
  })
  const length = res.headers.get('content-length')
  if (length) headers.set('content-length', length)
  return new Response(res.body, { status: 200, headers })
}

export const config: Config = { path: '/api/po-document' }
