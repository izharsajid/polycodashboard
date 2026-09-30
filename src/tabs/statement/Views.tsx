import { CheckCircle2, ExternalLink, PenLine, Plus, TriangleAlert } from 'lucide-react'
import PoDocuments from '../../components/PoDocuments'
import StatePill from '../../components/StatePill'
import type { Discrepancy, Line, Month, StatementModel } from '../../engine/statement'
import type { StatementFileT, WorkbookRowT } from '../../engine/statementSchema'
import { dispatchQuantityLines, type TrackerPo } from '../../engine/tracker'
import { amount, day } from '../../lib/format'
import type { Editor } from './editor'
import { UploadBox } from './Forms'
import { Figures, FileList, lineLook, MovementRow, PoChip, Tile } from './parts'

export type Nav = {
  line: (key: string) => void
  po: (po: string) => void
  correct: (lineKey: string) => void
  invoice: (po?: string) => void
  voidEntry: (id: string) => void
  fix: (key: string) => void
}

export function MonthView({ m, opening, filesFor, nav }: { m: Month; opening: number; filesFor: (target: string) => StatementFileT[]; nav: Nav }) {
  return (
    <div className="space-y-5 text-table">
      <Figures
        items={[
          { label: 'Brought forward (US$)', value: amount(opening) },
          { label: 'Received (US$)', value: amount(m.receivedCents), tone: 'income' },
          { label: 'Delivered (US$)', value: amount(-m.deliveredCents) },
          { label: 'Balance at month end (US$)', value: amount(m.balanceCents), tone: 'strong' },
        ]}
      />
      <ul className="divide-y divide-rule rounded-card bg-mist px-1">
        {m.movements.map((x) => (
          <MovementRow key={x.key} m={x} files={filesFor(x.line.key.replace(/^entry-/, 'entry-')).length} onLine={nav.line} onPo={nav.po} />
        ))}
      </ul>
    </div>
  )
}

function DiscrepancyItems({ items, onFix }: { items: Discrepancy[]; onFix: (key: string) => void }) {
  if (!items.length) return null
  return (
    <ul className="space-y-2">
      {items.map((d) => (
        <li key={d.id}>
          <button
            type="button"
            onClick={() => onFix(d.key)}
            className={`flex w-full gap-2 rounded-card p-3 text-left ${d.resolved ? 'bg-income-wash text-income' : 'bg-caution-wash text-caution'}`}
          >
            {d.resolved ? <CheckCircle2 size={16} aria-hidden className="mt-0.5 shrink-0" /> : <TriangleAlert size={16} aria-hidden className="mt-0.5 shrink-0" />}
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">
                {d.id}. {d.title}
              </span>
              <span className="block text-press">{d.resolved ? `Fixed by ${d.resolved.by}: ${d.resolved.note}` : d.detail}</span>
            </span>
            <span className="shrink-0 self-center rounded-full bg-sheet px-2.5 py-1 text-small font-semibold text-press">{d.resolved ? 'View' : 'Fix'}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

const cell = (v: string | number | null) => (v === null || v === '' ? '–' : typeof v === 'number' ? v.toLocaleString('en-US', { maximumFractionDigits: 3 }) : v)

export function LineView({
  line,
  raw,
  model,
  files,
  editor,
  onChanged,
  nav,
}: {
  line: Line
  raw: WorkbookRowT | null
  model: StatementModel
  files: StatementFileT[]
  editor: Editor | null
  onChanged: () => void
  nav: Nav
}) {
  const look = lineLook(line)
  const target = line.row !== null ? `row-${line.row}` : `entry-${line.entryId}`
  const issues = model.discrepancies.filter((d) => line.discrepancies.includes(d.id))
  return (
    <div className="space-y-5 text-table">
      <div className="flex items-start gap-3">
        <Tile Icon={look.Icon} tile={look.tile} size={36} />
        <div className="min-w-0">
          <p className="font-semibold">{line.ref}</p>
          {line.product && <p className="text-press-2">{line.product}</p>}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {line.po && <PoChip po={line.po} onOpen={nav.po} />}
            {line.tracker && <StatePill state={line.tracker.state} />}
            <span className="text-small text-press-2">
              {line.statusNote}
              {line.statusSource === 'efdashboard.com' ? ', per efdashboard.com' : line.statusSource === 'workbook' ? '' : ''}
            </span>
          </div>
        </div>
      </div>

      <Figures
        items={[
          ...(line.poAmountCents ? [{ label: 'PO value (US$)', value: amount(line.poAmountCents) }] : []),
          { label: 'Delivered (US$)', value: amount(line.deliveredCents), tone: line.kind === 'recharge' ? ('recharge' as const) : ('plain' as const) },
          { label: 'Received (US$)', value: amount(line.receivedCents), tone: 'income' as const },
          ...(line.openCents ? [{ label: 'Still to deliver (US$)', value: amount(line.openCents), tone: 'strong' as const }] : []),
        ]}
      />

      {line.corrections.map((c) => (
        <p key={c.entry.id} className="flex gap-2 rounded-card bg-caution-wash p-3 text-caution">
          <PenLine size={16} aria-hidden className="mt-0.5 shrink-0" />
          <span>
            <span className="font-semibold">
              {c.field === 'delivered' ? 'Delivered value' : c.field === 'received' ? 'Amount received' : 'PO value'} corrected from{' '}
              {amount(c.fromCents)} to {amount(Math.round(c.entry.amount * 100))}
            </span>
            <span className="block text-press">
              {c.entry.description}. {c.entry.by}, {day(c.entry.at.slice(0, 10))}.
            </span>
          </span>
        </p>
      ))}

      <DiscrepancyItems items={issues} onFix={nav.fix} />

      {line.dateNote && <p className="rounded-card bg-mist p-3 text-press-2">{line.dateNote}</p>}

      {raw && (
        <section aria-label="As issued on the workbook">
          <h3 className="kicker">As issued on the workbook, row {raw.row}</h3>
          <dl className="mt-2 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 rounded-card bg-mist p-3">
            {(
              [
                ['S.No.', raw.sno],
                ['PO No. and date', raw.ref],
                ['Product', raw.product],
                ['PO amount', raw.po_amount],
                ['Proforma', raw.proforma],
                ['Delivered value', raw.delivered],
                ['Received', raw.received],
                ['Funds received date', raw.received_date],
                ['Loaded on container', raw.loaded],
                ['Delivery date', raw.delivery_date],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-press-2">{k}</dt>
                <dd className="num break-words">{cell(v)}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <section aria-label="Files">
        <h3 className="kicker mb-2">{line.kind === 'recharge' ? 'Invoice and files' : 'Files'}</h3>
        <FileList files={files} />
        {editor && (
          <div className="mt-3">
            <UploadBox editor={editor} target={target} onDone={onChanged} />
          </div>
        )}
      </section>

      {editor && (
        <div className="flex flex-wrap gap-2 border-t border-rule pt-4">
          {line.source === 'workbook' && (
            <button type="button" className="btn-secondary" onClick={() => nav.correct(line.key)}>
              <PenLine size={15} aria-hidden /> Correct a figure
            </button>
          )}
          {line.source === 'recorded' && line.entryId && (
            <button type="button" className="btn-secondary" onClick={() => nav.voidEntry(line.entryId!)}>
              Void this change
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export function PoView({
  po,
  tracker,
  model,
  files,
  editor,
  onChanged,
  nav,
}: {
  po: string
  tracker: TrackerPo | null
  model: StatementModel
  files: StatementFileT[]
  editor: Editor | null
  onChanged: () => void
  nav: Nav
}) {
  const lines = model.lines.filter((l) => l.po === po)
  const issues = model.discrepancies.filter((d) => d.po === po)
  const qty = tracker ? dispatchQuantityLines(tracker) : []
  return (
    <div className="space-y-5 text-table">
      {tracker ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <StatePill state={tracker.state} />
            <span className="rounded-full border border-rule px-2 py-0.5 text-small font-semibold text-press-2">{tracker.customerTag}</span>
            {tracker.formerPo && <span className="text-small text-press-2">Former PO {tracker.formerPo}</span>}
          </div>
          <p>{tracker.product}</p>
          <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
            {tracker.orderedQuantities.map((q) => (
              <div key={q.label}>
                <dt className="text-small text-press-2">{q.label}</dt>
                <dd className="font-semibold">{q.quantity}</dd>
              </div>
            ))}
            {tracker.readyDate && (
              <div>
                <dt className="text-small text-press-2">Cargo ready</dt>
                <dd className="font-semibold">{day(tracker.readyDate)}</dd>
              </div>
            )}
            {tracker.dispatchDate && (
              <div>
                <dt className="text-small text-press-2">Dispatched</dt>
                <dd className="font-semibold text-income">
                  {day(tracker.dispatchDate)}
                  {qty.map((q) => (
                    <span key={q} className="block text-small font-normal text-press">{q}</span>
                  ))}
                </dd>
              </div>
            )}
          </dl>
          {tracker.remarks && <p className="whitespace-pre-line rounded-card bg-mist p-3 text-small">{tracker.remarks.replace(/\s*·\s*((?:Container|Seal):)/gi, '\n$1')}</p>}
          <p className="flex items-center gap-1 text-small text-press-2">
            <ExternalLink size={12} aria-hidden /> Status, dates and quantities from efdashboard.com, the master record.
          </p>
        </div>
      ) : (
        <p className="rounded-card bg-caution-wash p-3 text-caution">
          PO {po} is not on efdashboard.com's tracker. What follows is from the statement workbook only.
        </p>
      )}

      <section aria-label="On the statement">
        <h3 className="kicker mb-2">On the statement</h3>
        {lines.length ? (
          <ul className="divide-y divide-rule rounded-card bg-mist px-1">
            {lines.map((l) => {
              const look = lineLook(l)
              return (
                <li key={l.key}>
                  <button type="button" onClick={() => nav.line(l.key)} className="flex w-full items-center gap-3 px-2 py-2.5 text-left hover:bg-sheet">
                    <Tile Icon={look.Icon} tile={look.tile} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{l.kind === 'recharge' ? l.name : `${look.label}: ${l.statusNote}`}</span>
                      <span className="block text-small text-press-2">{l.source === 'workbook' ? `Workbook row ${l.row}` : l.statusNote}</span>
                    </span>
                    <span className="num text-right">
                      {amount(l.deliveredCents || l.openCents)}
                      <span className="block text-small text-press-2">{l.deliveredCents ? 'delivered' : 'to deliver'}</span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="text-press-2">No line on the statement carries this PO yet.</p>
        )}
      </section>

      <DiscrepancyItems items={issues} onFix={nav.fix} />

      <section aria-label="PO files">
        <h3 className="kicker mb-2">Files on efdashboard.com</h3>
        <PoDocuments documents={tracker?.documents ?? []} />
      </section>

      <section aria-label="Files uploaded here">
        <h3 className="kicker mb-2">Files uploaded here</h3>
        <FileList files={files} />
        {editor && (
          <div className="mt-3 space-y-3">
            <UploadBox editor={editor} target={`po-${po}`} onDone={onChanged} />
            <button type="button" className="btn-secondary" onClick={() => nav.invoice(po)}>
              <Plus size={15} aria-hidden /> Record an invoice for this PO
            </button>
          </div>
        )}
      </section>
    </div>
  )
}
