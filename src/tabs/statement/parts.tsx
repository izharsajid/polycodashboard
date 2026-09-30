import {
  Banknote,
  Download,
  Eye,
  FileText,
  Paperclip,
  PenLine,
  Receipt,
  Ship,
  TriangleAlert,
  Truck,
  type LucideIcon,
} from 'lucide-react'
import type { ReactNode } from 'react'
import type { Line, Movement } from '../../engine/statement'
import type { StatementFileT } from '../../engine/statementSchema'
import { amount, day } from '../../lib/format'
import { fileUrl } from './editor'

/**
 * How each kind of statement line looks, everywhere: goods in ink, money in
 * green, cargo clearing and freight recharges in their own orange so they stand
 * apart, other charges neutral.
 */
export function lineLook(line: Line, kind: Movement['kind'] | null = null): { Icon: LucideIcon; tile: string; label: string } {
  if (kind === 'receipt' || line.kind === 'receipt') return { Icon: Banknote, tile: 'bg-income-wash text-income', label: 'Payment' }
  if (line.kind === 'recharge') return { Icon: Ship, tile: 'bg-recharge-wash text-recharge', label: 'Recharge' }
  if (line.kind === 'charge') return { Icon: Receipt, tile: 'bg-mist text-press-2', label: 'Charge' }
  return { Icon: Truck, tile: 'bg-mist text-press', label: 'Delivery' }
}

export function Tile({ Icon, tile, size = 30 }: { Icon: LucideIcon; tile: string; size?: number }) {
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded ${tile}`}
      style={{ width: size, height: size }}
    >
      <Icon size={Math.round(size * 0.55)} strokeWidth={2.25} />
    </span>
  )
}

/** A PO number that opens the PO. */
export function PoChip({ po, onOpen }: { po: string; onOpen?: (po: string) => void }) {
  if (!onOpen) return <span className="font-semibold">PO {po}</span>
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onOpen(po)
      }}
      className="rounded-full bg-info-wash px-2 py-0.5 text-small font-semibold text-info hover:underline"
    >
      PO {po}
    </button>
  )
}

/** One movement on the statement: what it was, when, and its effect on the balance. */
export function MovementRow({
  m,
  files,
  onLine,
  onPo,
}: {
  m: Movement
  files: number
  onLine: (key: string) => void
  onPo: (po: string) => void
}) {
  const l = m.line
  const look = lineLook(l, m.kind)
  const incoming = m.kind === 'receipt'
  return (
    <li>
      <div
        role="button"
        tabIndex={0}
        onClick={() => onLine(l.key)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onLine(l.key)
          }
        }}
        className="flex w-full cursor-pointer items-start gap-3 rounded px-2 py-2.5 text-left hover:bg-sheet"
      >
        <Tile Icon={look.Icon} tile={look.tile} />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="font-semibold">{l.kind === 'order' && l.po ? 'Delivery' : l.name}</span>
            {l.po && (l.kind === 'order' || l.kind === 'recharge') && <PoChip po={l.po} onOpen={onPo} />}
            {l.discrepancies.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-caution-wash px-2 py-0.5 text-small font-semibold text-caution">
                <TriangleAlert size={12} aria-hidden /> {l.discrepancies.length}
              </span>
            )}
            {l.corrections.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-caution-wash px-2 py-0.5 text-small font-semibold text-caution">
                <PenLine size={12} aria-hidden /> Corrected
              </span>
            )}
            {files > 0 && (
              <span className="inline-flex items-center gap-1 text-small text-press-2">
                <Paperclip size={12} aria-hidden /> {files}
              </span>
            )}
          </span>
          <span className="mt-0.5 block text-small text-press-2">
            {[m.date ? day(m.date) : null, l.product, l.source === 'workbook' ? `Workbook row ${l.row}` : l.statusNote]
              .filter(Boolean)
              .join(' · ')}
          </span>
        </span>
        <span className={`num shrink-0 text-right ${incoming ? 'font-semibold text-income' : ''}`}>
          {incoming ? amount(m.cents) : amount(-m.cents)}
          <span className="block text-small font-normal text-press-2">{incoming ? 'received' : 'delivered'}</span>
        </span>
      </div>
    </li>
  )
}

/** Files uploaded against a line, entry or PO, each viewable and downloadable. */
export function FileList({ files }: { files: StatementFileT[] }) {
  if (files.length === 0) return <p className="text-small text-press-2">No files uploaded yet.</p>
  return (
    <ul className="space-y-1.5">
      {files.map((f) => (
        <li key={f.id} className="flex items-center justify-between gap-2 rounded bg-mist px-2.5 py-1.5">
          <span className="flex min-w-0 items-center gap-2">
            <FileText size={15} aria-hidden className="shrink-0 text-press-2" />
            <span className="min-w-0">
              <span className="block truncate text-table font-semibold">{f.filename}</span>
              <span className="block text-small text-press-2">
                {f.uploadedBy}, {day(f.uploadedAt.slice(0, 10))}
              </span>
            </span>
          </span>
          <span className="flex shrink-0 gap-1">
            <a href={fileUrl(f.id, 'view')} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center gap-1 rounded px-2 text-small font-semibold hover:bg-sheet">
              <Eye size={14} aria-hidden /> View
            </a>
            <a href={fileUrl(f.id, 'download')} className="inline-flex h-8 items-center gap-1 rounded px-2 text-small font-semibold hover:bg-sheet">
              <Download size={14} aria-hidden /> Download
            </a>
          </span>
        </li>
      ))}
    </ul>
  )
}

/** A labelled form field. */
export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="kicker block">{label}</span>
      {hint && <span className="block text-small text-press-2">{hint}</span>}
      <span className="mt-1 block">{children}</span>
    </label>
  )
}

/** The figure a panel is about, and the ones beside it. */
export function Figures({ items }: { items: { label: string; value: string; tone?: 'plain' | 'income' | 'strong' | 'recharge' }[] }) {
  return (
    <div className={`grid gap-2 ${items.length > 3 ? 'sm:grid-cols-4' : 'sm:grid-cols-3'}`}>
      {items.map((i) => (
        <div
          key={i.label}
          className={`rounded-card px-3 py-2.5 ${
            i.tone === 'income'
              ? 'bg-income-wash text-income'
              : i.tone === 'strong'
                ? 'bg-press text-sheet'
                : i.tone === 'recharge'
                  ? 'bg-recharge-wash text-recharge'
                  : 'bg-mist text-press'
          }`}
        >
          <p className="text-small opacity-80">{i.label}</p>
          <p className="num text-title font-bold">{i.value}</p>
        </div>
      ))}
    </div>
  )
}
