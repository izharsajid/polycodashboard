import { Download, Eye, FileText } from 'lucide-react'
import type { TrackerDocumentT } from '../engine/trackerSchema'

/**
 * A PO's files from efdashboard.com, each viewable and downloadable through this
 * site's /api/po-document, which fetches them from efdashboard.com.
 */
export function poDocumentUrl(d: TrackerDocumentT, action: 'view' | 'download') {
  const q = new URLSearchParams({ po: d.po, file: d.name, action })
  return `/api/po-document?${q}`
}

export default function PoDocuments({ documents, compact = false }: { documents: TrackerDocumentT[]; compact?: boolean }) {
  if (documents.length === 0) return <p className="text-small text-press-2">No files on efdashboard.com yet.</p>
  return (
    <ul className={compact ? 'space-y-1.5' : 'grid gap-2 sm:grid-cols-2'}>
      {documents.map((d) => (
        <li
          key={`${d.po}-${d.name}`}
          className={`flex gap-2 rounded bg-mist px-2.5 py-1.5 ${compact ? 'flex-col' : 'items-center justify-between'}`}
        >
          <span className="flex min-w-0 items-center gap-2">
            <FileText size={15} aria-hidden className="shrink-0 text-press-2" />
            <span className="min-w-0">
              <span className={`block text-table font-semibold ${compact ? '' : 'truncate'}`}>{d.title}</span>
              {d.note && <span className={`block text-small text-press-2 ${compact ? '' : 'truncate'}`}>{d.note}</span>}
            </span>
          </span>
          <span className={`flex shrink-0 gap-1 ${compact ? '-ml-2' : ''}`}>
            <a
              href={poDocumentUrl(d, 'view')}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-8 items-center gap-1 rounded px-2 text-small font-semibold text-press hover:bg-sheet"
              aria-label={`View ${d.title} for PO ${d.po}`}
            >
              <Eye size={14} aria-hidden /> View
            </a>
            <a
              href={poDocumentUrl(d, 'download')}
              className="inline-flex h-8 items-center gap-1 rounded px-2 text-small font-semibold text-press hover:bg-sheet"
              aria-label={`Download ${d.title} for PO ${d.po}`}
            >
              <Download size={14} aria-hidden /> Download
            </a>
          </span>
        </li>
      ))}
    </ul>
  )
}
