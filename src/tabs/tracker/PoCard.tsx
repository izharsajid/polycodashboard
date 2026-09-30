import { Building2, Plane } from 'lucide-react'
import type { ReactNode } from 'react'
import PoDocuments from '../../components/PoDocuments'
import StatePill from '../../components/StatePill'
import { dispatchQuantityLines, type TrackerPo } from '../../engine/tracker'
import { day } from '../../lib/format'

/**
 * One order, with everything efdashboard.com shows for it: PO and former PO,
 * product and customer tag, ordered quantities, status, cargo ready, dispatch
 * and quantities, film usage, remarks, and its files.
 */
export default function PoCard({ p, onOpen }: { p: TrackerPo; onOpen?: () => void }) {
  const qty = dispatchQuantityLines(p)
  const Title = onOpen ? 'button' : 'div'

  return (
    <article className={`rounded-card border bg-sheet p-4 shadow-card ${p.isDispatched ? 'border-rule' : 'border-info/40'}`}>
      <div className="grid gap-4 lg:grid-cols-[2fr_1.4fr_1.2fr_1.5fr_2.4fr]">
        <div className="min-w-0">
          <Title
            {...(onOpen ? { type: 'button' as const, onClick: onOpen } : {})}
            className={`text-left ${onOpen ? 'hover:underline' : ''}`}
          >
            <span className="condensed block text-title font-bold">PO {p.po}</span>
          </Title>
          {p.formerPo && <p className="text-small text-press-2">Former PO {p.formerPo}</p>}
          <p className="mt-1 text-table">{p.product}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="rounded-full border border-rule px-2 py-0.5 text-small font-semibold tracking-wide text-press-2">
              {p.customerTag}
            </span>
            {p.isAirfreight && (
              <span className="inline-flex items-center gap-1 rounded-full bg-info-wash px-2 py-0.5 text-small font-semibold text-info">
                <Plane size={12} aria-hidden /> Airfreight
              </span>
            )}
            {p.isInternal && (
              <span className="inline-flex items-center gap-1 rounded-full bg-caution-wash px-2 py-0.5 text-small font-semibold text-caution">
                <Building2 size={12} aria-hidden /> EcoFibre order
              </span>
            )}
          </div>
        </div>

        <Cell label="Ordered">
          {p.orderedQuantities.length ? (
            <ul className="space-y-1">
              {p.orderedQuantities.map((q) => (
                <li key={q.label}>
                  <span className="block text-small text-press-2">{q.label}</span>
                  <span className="font-semibold">{q.quantity}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty />
          )}
        </Cell>

        <Cell label="Status">
          <StatePill state={p.state} />
          {p.shippingDetail && <p className="mt-1 text-small text-press-2">{p.shippingDetail}</p>}
          {p.readyDate || p.ready ? (
            <p className="mt-2 text-small">
              <span className="text-press-2">Cargo ready </span>
              <span className="font-semibold">{p.readyDate ? day(p.readyDate) : p.ready}</span>
            </p>
          ) : null}
        </Cell>

        <Cell label="Dispatch">
          {p.partialDispatches.length ? (
            <ul className="space-y-1.5">
              {p.partialDispatches.map((d) => (
                <li key={d.label} className="rounded bg-mist px-2 py-1">
                  <span className="block font-semibold">{d.label} · {d.status}</span>
                  {[d.date, d.pallets, d.quantity, d.note].filter(Boolean).map((x) => (
                    <span key={x} className="block text-small text-press-2">{x}</span>
                  ))}
                </li>
              ))}
            </ul>
          ) : p.dispatchDate ? (
            <>
              <p className="font-semibold text-income">Dispatched {day(p.dispatchDate)}</p>
              {qty.map((q) => (
                <p key={q} className="text-small">{q}</p>
              ))}
            </>
          ) : (
            <Empty />
          )}
          {(p.film || p.rolls) && (
            <p className="mt-2 text-small">
              <span className="text-press-2">Film </span>
              {p.film}
              {p.rolls && p.rolls !== '-' ? `, ${p.rolls}` : ''}
            </p>
          )}
        </Cell>

        <Cell label="Remarks and files">
          {p.remarks && <p className="mb-2 whitespace-pre-line text-small">{p.remarks.replace(/\s*·\s*((?:Container|Seal):)/gi, '\n$1')}</p>}
          <PoDocuments documents={p.documents} compact />
        </Cell>
      </div>
    </article>
  )
}

function Cell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 text-table">
      <p className="mb-1 text-small font-semibold text-press-2 lg:sr-only">{label}</p>
      {children}
    </div>
  )
}

function Empty() {
  return <span className="text-press-2">–</span>
}
