import { ChevronDown, ChevronRight, TriangleAlert } from 'lucide-react'
import { Fragment, useState } from 'react'
import { kindLabel, type Model, type Statement } from '../../engine/funds'
import { amount, monthLong, range } from '../../lib/format'

/**
 * One row per month, newest first: what it cost, anything received against
 * that, and what was asked of Polyco. Any month opens to its lines, remarks and
 * notes exactly as issued.
 */
export default function MonthTable({ model }: { model: Model }) {
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set())
  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const rows = [...model.statements].reverse()

  return (
    <table className="w-full border-collapse">
      <caption className="sr-only">Funds requested month by month, newest first</caption>
      <thead>
        <tr>
          <th scope="col" className="th pl-0">Month</th>
          <th scope="col" className="th hidden text-right sm:table-cell">Costs (US$)</th>
          <th scope="col" className="th hidden text-right sm:table-cell">Other income (US$)</th>
          <th scope="col" className="th text-right">Requested (US$)</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((s) => {
          const isOpen = open.has(s.id)
          const detailId = `month-${s.id}`
          return (
            <Fragment key={s.id}>
              <tr className={s.isRequest ? '' : 'text-press-2'}>
                <th scope="row" className="td pl-0 text-left font-normal">
                  <button
                    type="button"
                    onClick={() => toggle(s.id)}
                    aria-expanded={isOpen}
                    aria-controls={detailId}
                    className="flex min-h-[40px] w-full items-start gap-1.5 text-left"
                  >
                    {isOpen ? (
                      <ChevronDown size={16} aria-hidden className="no-print mt-0.5 shrink-0" />
                    ) : (
                      <ChevronRight size={16} aria-hidden className="no-print mt-0.5 shrink-0" />
                    )}
                    <span>
                      <span className="block font-semibold text-press">{monthLong(s.id)}</span>
                      <span className="block text-small text-press-2">{range(s.periodStart, s.periodEnd)}</span>
                      {!s.isRequest && <span className="block text-small">{kindLabel(s.kind)}</span>}
                    </span>
                  </button>
                </th>
                <td className="td num hidden text-right sm:table-cell">{amount(s.costsCents)}</td>
                <td className="td num hidden text-right sm:table-cell">
                  {s.incomeCents ? amount(-s.incomeCents) : ''}
                </td>
                <td className="td num text-right font-semibold">
                  {s.isRequest ? amount(s.statedCents) : <span className="font-normal">Not a request</span>}
                </td>
              </tr>
              {isOpen && (
                <tr id={detailId}>
                  <td colSpan={4} className="border-b border-rule bg-zinc px-3 py-4 sm:px-5">
                    <Lines s={s} />
                  </td>
                </tr>
              )}
            </Fragment>
          )
        })}
      </tbody>
      <tfoot>
        <tr className="border-t-2 border-press">
          <th scope="row" className="py-2.5 pl-0 text-left text-table font-semibold">
            Total requested
            <span className="block text-small font-normal text-press-2">
              {model.requestCount} requests{model.excluded.length ? `, not counting ${model.excluded.map((s) => monthLong(s.id)).join(', ')} actuals` : ''}
            </span>
          </th>
          <td className="hidden sm:table-cell" />
          <td className="hidden sm:table-cell" />
          <td className="num px-3 py-2.5 text-right align-top text-table font-semibold">{amount(model.requestedCents)}</td>
        </tr>
      </tfoot>
    </table>
  )
}

function Lines({ s }: { s: Statement }) {
  return (
    <div className="text-table">
      <ul className="divide-y divide-rule">
        {s.lines.map((l, i) => (
          <li key={i} className="flex justify-between gap-4 py-1.5">
            <span>
              {l.description}
              {l.remarks && <span className="block text-small text-press-2">{l.remarks}</span>}
            </span>
            <span className="num shrink-0">{amount(l.cents)}</span>
          </li>
        ))}
      </ul>

      {s.income.length > 0 && (
        <>
          <p className="mt-2 flex justify-between gap-4 border-t border-press pt-1.5 font-semibold">
            <span>Costs</span>
            <span className="num">{amount(s.costsCents)}</span>
          </p>
          <ul>
            {s.income.map((l, i) => (
              <li key={i} className="flex justify-between gap-4 py-1.5">
                <span>
                  Less: {l.description}
                  {l.remarks && <span className="block text-small text-press-2">{l.remarks}</span>}
                </span>
                <span className="num shrink-0">{amount(-l.cents)}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="mt-2 flex justify-between gap-4 border-t-2 border-press pt-1.5 font-semibold">
        <span>{s.isRequest ? 'Requested' : 'Spent'}</span>
        <span className="num">{amount(s.statedCents)}</span>
      </p>

      {s.notes.length > 0 && (
        <ul className="mt-3 space-y-1 text-small text-press-2">
          {s.notes.map((n) =>
            /^exception:/i.test(n) ? (
              <li key={n} className="flex gap-1.5 font-semibold text-press">
                <TriangleAlert size={14} aria-hidden className="mt-0.5 shrink-0" />
                {n}
              </li>
            ) : (
              <li key={n}>{n}</li>
            ),
          )}
        </ul>
      )}
    </div>
  )
}
