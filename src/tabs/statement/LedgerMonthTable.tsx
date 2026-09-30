import { ChevronDown, ChevronRight } from 'lucide-react'
import { Fragment, useState } from 'react'
import type { LedgerModel, Movement } from '../../engine/ledger'
import { amount, day, monthLong } from '../../lib/format'
import { describe } from './describe'

/**
 * One row per month, newest first: what was delivered, what was received, and
 * the balance at month end. Any month opens to its movements. The foot adds the
 * unresolved movements to reach the closing balance, so the statement ties.
 */
export default function LedgerMonthTable({ model }: { model: LedgerModel }) {
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set())
  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const rows = [...model.months].reverse()

  return (
    <table className="w-full border-collapse">
      <caption className="sr-only">The balance month by month, newest first</caption>
      <thead>
        <tr>
          <th scope="col" className="th pl-0">Month</th>
          <th scope="col" className="th hidden text-right sm:table-cell">Delivered (US$)</th>
          <th scope="col" className="th hidden text-right sm:table-cell">Received (US$)</th>
          <th scope="col" className="th text-right">Balance at month end (US$)</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((m) => {
          const isOpen = open.has(m.month)
          const detailId = `ledger-${m.month}`
          const empty = m.movements.length === 0
          return (
            <Fragment key={m.month}>
              <tr className={empty ? 'text-press-2' : ''}>
                <th scope="row" className="td pl-0 text-left font-normal">
                  {empty ? (
                    <span className="flex min-h-[32px] items-center pl-[22px]">
                      {monthLong(m.month)}
                      <span className="ml-2 text-small">no movements</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => toggle(m.month)}
                      aria-expanded={isOpen}
                      aria-controls={detailId}
                      className="flex min-h-[32px] w-full items-center gap-1.5 text-left"
                    >
                      {isOpen ? (
                        <ChevronDown size={16} aria-hidden className="no-print shrink-0" />
                      ) : (
                        <ChevronRight size={16} aria-hidden className="no-print shrink-0" />
                      )}
                      <span className="font-semibold text-press">{monthLong(m.month)}</span>
                    </button>
                  )}
                </th>
                <td className="td num hidden text-right sm:table-cell">{m.deliveredCents ? amount(m.deliveredCents) : ''}</td>
                <td className="td num hidden text-right sm:table-cell">{m.receivedCents ? amount(m.receivedCents) : ''}</td>
                <td className="td num text-right font-semibold">{amount(m.balanceCents)}</td>
              </tr>
              {isOpen && (
                <tr id={detailId}>
                  <td colSpan={4} className="border-b border-rule bg-zinc px-3 py-3 sm:px-5">
                    <Movements movements={m.movements} />
                  </td>
                </tr>
              )}
            </Fragment>
          )
        })}
      </tbody>
      <tfoot className="text-table">
        <tr className="border-t-2 border-press">
          <th scope="row" className="py-2 pl-0 text-left font-normal">Balance from months with confirmed dates</th>
          <td className="hidden sm:table-cell" />
          <td className="hidden sm:table-cell" />
          <td className="num px-3 py-2 text-right">{amount(model.datedBalanceCents)}</td>
        </tr>
        <tr>
          <th scope="row" className="py-2 pl-0 text-left font-normal">
            Movements with unresolved dates, net
            <span className="block text-small text-press-2">Listed under Unresolved</span>
          </th>
          <td className="hidden sm:table-cell" />
          <td className="hidden sm:table-cell" />
          <td className="num px-3 py-2 text-right align-top">{amount(model.unresolvedNetCents)}</td>
        </tr>
        <tr className="border-t-2 border-press">
          <th scope="row" className="py-2.5 pl-0 text-left font-semibold">
            Balance held by EcoFibre
            <span className="block text-small font-normal text-press-2">As at {day(model.asAt)}</span>
          </th>
          <td className="hidden sm:table-cell" />
          <td className="hidden sm:table-cell" />
          <td className="num px-3 py-2.5 text-right align-top font-semibold">{amount(model.bridge.balanceCents)}</td>
        </tr>
      </tfoot>
    </table>
  )
}

function Movements({ movements }: { movements: Movement[] }) {
  return (
    <ul className="divide-y divide-rule text-table">
      {movements.map((m) => (
        <li key={m.key} className="flex justify-between gap-4 py-1.5">
          <span>
            <span className="text-press-2">{m.date ? day(m.date) : ''}</span>{' '}
            {describe(m)}
            {m.unattributed && (
              <span className="ml-2 border border-press-2 px-1 text-small font-semibold uppercase tracking-wide text-press-2">
                Unattributed
              </span>
            )}
            <span className="block text-small text-press-2">Workbook row {m.sourceRow}</span>
          </span>
          <span className="num shrink-0 text-right">
            {m.kind === 'receipt' ? amount(m.cents) : amount(-m.cents)}
            <span className="block text-small text-press-2">{m.kind === 'receipt' ? 'received' : 'delivered'}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}
