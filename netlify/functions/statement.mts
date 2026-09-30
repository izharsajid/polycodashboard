import type { Config } from '@netlify/functions'
import disputes from '../../data/ledger-disputes.json' with { type: 'json' }
import workbook from '../../data/polyco-statement.json' with { type: 'json' }
import { editorEnabled } from '../lib/editor'
import { json, wrongMethod } from '../lib/http'
import { listEntries, listStatementFiles } from '../lib/statement-store'

/**
 * The statement: the workbook as issued, the disputed dates, and everything
 * recorded on this site since. efdashboard.com's tracker is read separately from
 * /api/tracker, so a slow master never holds up the statement.
 */
export default async (req: Request) => {
  const badMethod = wrongMethod(req, 'GET')
  if (badMethod) return badMethod

  const [entries, files] = await Promise.all([listEntries(), listStatementFiles()])
  return json(
    {
      workbook,
      disputes,
      entries,
      files: files.map((f) => ({
        id: f.id,
        target: f.orderId.replace(/^stmt:/, ''),
        filename: f.filename,
        contentType: f.contentType,
        size: f.size,
        uploadedBy: f.uploadedBy,
        uploadedAt: f.uploadedAt,
      })),
      editor: { enabled: editorEnabled() },
    },
    200,
    { 'x-robots-tag': 'noindex, nofollow' },
  )
}

export const config: Config = { path: '/api/statement' }
