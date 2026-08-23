import { useCallback, useEffect, useRef, useState } from 'react'
import type { DocumentGroupT, DocumentMetaT } from '../../netlify/lib/documents'
import type { LedgerRowT, PoOrderT } from '../lib/schema'
import { money } from '../lib/format'
import { api } from '../lib/api'
import { whenLocal } from '../lib/format'
import { StatusPill } from './Pill'
import {
  Download, Eye, FileImage, FileSpreadsheet, FileText, Trash2, Upload, X,
} from 'lucide-react'

/** A distinguishing mark per file type, so a list of documents is scannable. */
function typeIcon(contentType: string) {
  if (contentType.startsWith('image/')) return FileImage
  if (/sheet|excel/.test(contentType)) return FileSpreadsheet
  return FileText
}

const GROUPS: { key: DocumentGroupT; label: string; lede: string }[] = [
  { key: 'purchase-order', label: 'Purchase order', lede: 'The order as issued, and any revision.' },
  {
    key: 'delivery',
    label: 'Delivery',
    lede: 'Packing list, invoice, bill of lading, certificate of analysis, inspection, customs, photographs.',
  },
]

function dayLong(iso: string | null) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${Number(d)} ${names[Number(m) - 1]} ${y}`
}

const readableSize = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`

/**
 * One order, opened. PO-TRACKER-SPEC section 3: everything the table shows plus
 * the full order, the matching ledger entries, any flags, and the documents.
 */
export default function OrderPanel({
  order, ledger, isAdmin, onClose,
}: {
  order: PoOrderT
  ledger: { rows: LedgerRowT[]; exact: boolean }
  isAdmin: boolean
  onClose: () => void
}) {
  const [documents, setDocuments] = useState<DocumentMetaT[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState<DocumentGroupT | null>(null)
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({})

  const load = useCallback(async () => {
    const result = await api.get<{ documents: DocumentMetaT[] }>(
      `/api/orders/${encodeURIComponent(order.po_number)}`,
    )
    if (result.ok) setDocuments(result.data.documents)
    else setError(result.error)
  }, [order.po_number])

  useEffect(() => {
    void load()
  }, [load])

  async function upload(group: DocumentGroupT, files: FileList | null) {
    if (!files || files.length === 0) return
    setBusy(true)
    setError(null)

    for (const file of Array.from(files)) {
      const form = new FormData()
      form.set('group', group)
      form.set('file', file)

      const res = await fetch(`/api/orders/${encodeURIComponent(order.po_number)}/documents`, {
        method: 'POST',
        credentials: 'same-origin',
        body: form,
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null
        setError(body?.error ?? 'That upload did not work. Try again.')
        break
      }
    }

    setBusy(false)
    await load()
  }

  async function softDelete(document: DocumentMetaT) {
    setBusy(true)
    setError(null)
    const res = await fetch(`/api/documents/${document.id}`, {
      method: 'DELETE',
      credentials: 'same-origin',
    })
    setBusy(false)
    if (!res.ok) setError('That document could not be removed.')
    await load()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-ink/20 no-print"
      role="dialog"
      aria-modal="true"
      aria-label={`Order ${order.po_number}`}
      onClick={onClose}
    >
      <div
        className="h-full w-full max-w-2xl overflow-y-auto bg-surface "
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 border-b border-rule bg-surface px-2 py-2 flex items-start justify-between gap-2">
          <div>
            <p className="eyebrow">Order</p>
            <h2 className="mt-1 text-title font-semibold text-accent">{order.po_number}</h2>
            <p className="lede mt-1">{order.product}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary inline-flex items-center gap-1"
          >
            <X size={13} aria-hidden /> Close
          </button>
        </div>

        <div className="px-2 py-3">
          <dl className="grid grid-cols-[9rem_1fr] gap-y-2 text-table">
            <dt className="eyebrow self-center">Status</dt>
            <dd><StatusPill status={order.order_status} /></dd>
            <dt className="eyebrow self-center">Cargo ready</dt>
            <dd>{order.cargo_ready_date ? dayLong(order.cargo_ready_date) : order.cargo_ready || '—'}</dd>
            <dt className="eyebrow self-center">Dispatched</dt>
            <dd>{order.dispatched_date ? dayLong(order.dispatched_date) : order.dispatched || 'Not dispatched'}</dd>
            <dt className="eyebrow self-center">Film</dt>
            <dd>{order.film || '—'}{order.rolls ? `, ${order.rolls}` : ''}</dd>
            <dt className="eyebrow self-center">Quantity</dt>
            <dd>{order.qty || '—'}</dd>
            <dt className="eyebrow self-center">Remarks</dt>
            <dd className="text-ink-70">{order.remarks || '—'}</dd>
            <dt className="eyebrow self-center">Tracker row</dt>
            <dd className="num">{order.row_no}</dd>
          </dl>

          <section className="mt-4 border-t border-rule pt-3">
            <h3 className="text-body font-semibold text-ink">Matching ledger entries</h3>
            {ledger.rows.length === 0 ? (
              <p className="lede mt-1">
                Nothing in the statement ledger carries this reference. For an order that has not
                shipped, that is expected.
              </p>
            ) : (
              <>
                {!ledger.exact && (
                  <p className="lede mt-1 text-watch">
                    Matched on the base number, not the full reference. The two systems spell this
                    one differently.
                  </p>
                )}
                <table className="mt-2 w-full text-table">
                  <tbody>
                    {ledger.rows.map((row) => (
                      <tr key={row.source_row} className="border-b border-rule align-top">
                        <td className="py-1 pr-2 num text-ink-50">{row.source_row}</td>
                        <td className="py-1 pr-2">{row.type}</td>
                        <td className="py-1 pr-2 text-ink-70">{row.po_number}</td>
                        <td className="py-1 pr-2 text-right num whitespace-nowrap">
                          {row.delivered_value ? money(row.delivered_value) : ''}
                        </td>
                        <td className="py-1 whitespace-nowrap text-ink-70">
                          {row.delivery_date ?? ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {ledger.rows.some((r) => r.flags.length > 0) && (
                  <p className="lede mt-1 text-watch">
                    {ledger.rows.filter((r) => r.flags.length > 0).length} of these carry a data flag.
                  </p>
                )}
              </>
            )}
          </section>

          {error && (
            <p role="alert" className="mt-3 border-l-2 border-critical pl-2 py-1 text-table">
              {error}
            </p>
          )}

          {GROUPS.map((group) => {
            const mine = (documents ?? []).filter((d) => d.group === group.key)
            return (
              <section key={group.key} className="mt-4 border-t border-rule pt-3">
                <h3 className="text-body font-semibold text-ink">{group.label}</h3>
                <p className="lede mt-1">{group.lede}</p>

                {documents === null ? (
                  <p className="lede mt-2">Loading.</p>
                ) : mine.length === 0 ? (
                  <p className="lede mt-2">
                    {group.key === 'purchase-order'
                      ? 'No purchase order uploaded yet. Drop the PO here.'
                      : 'No delivery paperwork yet. Drop the packing list or bill of lading here.'}
                  </p>
                ) : (
                  <ul className="mt-2 flex flex-col gap-1">
                    {mine.map((document) => {
                      const DocIcon = typeIcon(document.contentType)
                      return (
                      <li
                        key={document.id}
                        className={`rulebox rounded px-2 py-1 flex flex-wrap items-baseline gap-x-2 gap-y-1 ${
                          document.deletedAt ? 'opacity-60' : ''
                        }`}
                      >
                        <DocIcon size={13} aria-hidden className="shrink-0 text-ink-50" />
                        <span className="font-semibold text-ink">{document.filename}</span>
                        <span className="lede">
                          {readableSize(document.size)} · {document.uploadedByEmail} ·{' '}
                          {whenLocal(document.uploadedAt)}
                        </span>
                        {document.deletedAt && (
                          <span className="rounded bg-critical-soft px-1 py-[2px] text-eyebrow font-semibold text-critical">
                            Deleted by {document.deletedByEmail}
                          </span>
                        )}
                        <span className="ml-auto flex gap-2 text-label">
                          <a
                            href={`/api/documents/${document.id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-accent underline underline-offset-2"
                          >
                            <Eye size={13} aria-hidden /> View
                          </a>
                          <a
                            href={`/api/documents/${document.id}?download=1`}
                            className="inline-flex items-center gap-1 text-accent underline underline-offset-2"
                          >
                            <Download size={13} aria-hidden /> Download
                          </a>
                          {isAdmin && !document.deletedAt && (
                            <button
                              type="button"
                              onClick={() => void softDelete(document)}
                              className="inline-flex items-center gap-1 text-critical underline underline-offset-2"
                            >
                              <Trash2 size={13} aria-hidden /> Delete
                            </button>
                          )}
                        </span>
                      </li>
                      )
                    })}
                  </ul>
                )}

                <div
                  onDragOver={(e) => {
                    e.preventDefault()
                    setDragging(group.key)
                  }}
                  onDragLeave={() => setDragging(null)}
                  onDrop={(e) => {
                    e.preventDefault()
                    setDragging(null)
                    void upload(group.key, e.dataTransfer.files)
                  }}
                  className={`mt-2 rounded border border-dashed px-2 py-3 text-center ${
                    dragging === group.key ? 'border-accent bg-accent-soft' : 'border-rule'
                  }`}
                >
                  <Upload size={19} aria-hidden className="mx-auto mb-1 text-ink-30" />
                  <p className="lede">
                    Drop a file here, or{' '}
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => fileInputs.current[group.key]?.click()}
                      className="text-accent underline underline-offset-2 disabled:opacity-50"
                    >
                      choose one
                    </button>
                    . PDF, JPEG, PNG, Word, Excel or PowerPoint, up to 20 MB.
                  </p>
                  <input
                    ref={(el) => {
                      fileInputs.current[group.key] = el
                    }}
                    type="file"
                    multiple
                    hidden
                    onChange={(e) => void upload(group.key, e.target.files)}
                  />
                </div>
              </section>
            )
          })}
        </div>
      </div>
    </div>
  )
}
