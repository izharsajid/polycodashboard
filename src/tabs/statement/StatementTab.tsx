import { CalendarX2, Scale } from 'lucide-react'
import { useMemo, useState } from 'react'
import MonthBars from '../../components/MonthBars'
import { LedgerPayload } from '../../data/schemas'
import { useApiData } from '../../data/useApiData'
import { buildLedgerModel, type LedgerModel } from '../../engine/ledger'
import type { LedgerDisputesT, LedgerT } from '../../engine/ledgerSchema'
import { amount, day, monthLong, usd } from '../../lib/format'
import LedgerMonthCard from './LedgerMonthCard'
import LedgerMonthPanel from './LedgerMonthPanel'
import UnresolvedTable from './UnresolvedTable'

/**
 * Tab 2, PHL/EcoFibre Statement. Every delivery, recharge and payment between
 * the two companies: the position, the balance month by month as cards, and
 * whatever is not yet agreed, shown as unresolved rather than assumed.
 */
export default function StatementTab() {
  const payload = useApiData('/api/ledger', LedgerPayload, 'ledger')

  if (payload.status === 'loading') {
    return (
      <p className="mt-8 text-body text-press-2" aria-busy="true">
        Loading the ledger.
      </p>
    )
  }
  if (payload.status === 'failed') {
    return (
      <p role="alert" className="mt-8 max-w-prose rounded-card border-l-3 border-alert bg-sheet py-3 pl-4 pr-4 text-body text-alert">
        {payload.error}
      </p>
    )
  }
  return <Statement ledger={payload.data.ledger} disputes={payload.data.disputes} />
}

function Statement({ ledger, disputes }: { ledger: LedgerT; disputes: LedgerDisputesT }) {
  const model = useMemo(() => buildLedgerModel(ledger, disputes), [ledger, disputes])
  return <Page model={model} />
}

function Page({ model }: { model: LedgerModel }) {
  const b = model.bridge
  const [openMonth, setOpenMonth] = useState<string | null>(null)
  const openIndex = model.months.findIndex((m) => m.month === openMonth)
  const open = openIndex >= 0 ? model.months[openIndex] : null
  const opening = openIndex > 0 ? model.months[openIndex - 1].balanceCents : 0

  const newestFirst = [...model.months].reverse()
  const years = [...new Set(newestFirst.map((m) => m.month.slice(0, 4)))]
  const unresolvedCount = model.unresolved.length

  return (
    <div className="space-y-8 pt-6">
      <header>
        <h1 className="condensed text-figure font-bold">PHL/EcoFibre statement</h1>
        <p className="mt-1 max-w-prose text-table text-press-2">
          Every delivery, recharge and payment between Eco Fibre Bahrain W.L.L. and Polyco Healthline Ltd, as at{' '}
          {day(model.asAt)}. Money received from Polyco raises the balance and value delivered lowers it, so a positive
          balance is Polyco's money that EcoFibre holds and has not yet delivered as goods. Since June 2025 Polyco has
          paid against EcoFibre's monthly funding statements, approved line by line.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[5fr_7fr]">
        <section aria-labelledby="position-title" className="rounded-card bg-sheet p-5 shadow-card">
          <h2 id="position-title" className="flex items-center gap-2 text-title font-bold">
            <Scale size={20} aria-hidden /> The position
          </h2>
          <table className="mt-3 w-full border-collapse text-table">
            <caption className="sr-only">From money received to the uncovered advance</caption>
            <tbody>
              <BridgeRow label="Received from Polyco" cents={b.receivedCents} tone="income" />
              <BridgeRow label="Less delivered to Polyco" cents={-b.deliveredCents} />
              <tr>
                <th scope="row" className="pb-2 pl-4 text-left text-small font-normal text-press-2">
                  Of which cargo clearing and freight recharged, already included and not deducted again
                </th>
                <td className="num pb-2 text-right align-top text-small text-press-2">{amount(b.rechargesCents)}</td>
              </tr>
              <BridgeRow label="Balance held by EcoFibre" cents={b.balanceCents} total />
              <BridgeRow label="Less POs pending delivery" cents={-b.pendingPosCents} />
              <BridgeRow label="Less containers ready, next month" cents={-b.containersReadyCents} />
              <BridgeRow label="Less containers in process, the month after" cents={-b.containersInProcessCents} />
            </tbody>
          </table>
          <div className="mt-2 flex items-baseline justify-between gap-4 rounded-card bg-press px-3 py-2.5 text-sheet">
            <span className="font-semibold">Uncovered advance (US$)</span>
            <span className="num text-title font-bold">{amount(b.uncoveredCents)}</span>
          </div>
        </section>

        <section aria-labelledby="balance-title" className="rounded-card bg-sheet p-5 shadow-card">
          <h2 id="balance-title" className="text-title font-bold">Balance at each month end</h2>
          <p className="mt-1 text-small text-press-2">
            From movements with a confirmed date. The {unresolvedCount} with a date not yet agreed, net{' '}
            {usd(model.unresolvedNetCents)}, are added at the end.
          </p>
          <figure className="mt-4">
            <MonthBars
              label={`Balance at each month end. ${model.headline}`}
              bars={model.months.map((m) => ({
                id: m.month,
                cents: m.balanceCents,
                title: `${monthLong(m.month)}: balance ${usd(m.balanceCents)} at month end`,
              }))}
            />
          </figure>
        </section>
      </div>

      {years.map((year) => (
        <section key={year} aria-labelledby={`ledger-year-${year}`}>
          <h2 id={`ledger-year-${year}`} className="condensed mb-3 text-title font-bold text-press-2">
            {year}
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {newestFirst
              .filter((m) => m.month.startsWith(year))
              .map((m) => (
                <li key={m.month}>
                  <LedgerMonthCard m={m} onOpen={() => setOpenMonth(m.month)} />
                </li>
              ))}
          </ul>
        </section>
      ))}

      <section aria-labelledby="close-title" className="max-w-2xl rounded-card bg-sheet p-5 shadow-card">
        <h2 id="close-title" className="text-title font-bold">Closing balance</h2>
        <dl className="mt-3 space-y-2 text-table">
          <div className="flex justify-between gap-4">
            <dt>Balance from months with confirmed dates</dt>
            <dd className="num">{amount(model.datedBalanceCents)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Movements with unresolved dates, net</dt>
            <dd className="num">{amount(model.unresolvedNetCents)}</dd>
          </div>
          <div className="flex justify-between gap-4 border-t-2 border-press pt-2 font-semibold">
            <dt>Balance held by EcoFibre, {day(model.asAt)}</dt>
            <dd className="num">{amount(b.balanceCents)}</dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="unresolved-title" className="rounded-card bg-sheet p-5 shadow-card">
        <h2 id="unresolved-title" className="flex items-center gap-2 text-title font-bold">
          <CalendarX2 size={20} aria-hidden /> Unresolved
        </h2>
        <p className="mt-1 max-w-prose text-table text-press-2">
          {unresolvedCount} {unresolvedCount === 1 ? 'movement has' : 'movements have'} a date nobody has confirmed, so
          none is placed in a month. {model.unattributed.count} receipts totalling {usd(model.unattributed.cents)} are
          lump sums not tied to any PO; each is marked unattributed in its month.
        </p>
        <div className="mt-3">
          <UnresolvedTable movements={model.unresolved} />
        </div>
      </section>

      <LedgerMonthPanel m={open} opening={opening} onClose={() => setOpenMonth(null)} />
    </div>
  )
}

function BridgeRow({ label, cents, total = false, tone }: { label: string; cents: number; total?: boolean; tone?: 'income' }) {
  return (
    <tr className={total ? 'border-t-2 border-press' : ''}>
      <th scope="row" className={`py-1.5 text-left ${total ? 'font-semibold' : 'font-normal'} ${tone === 'income' ? 'text-income' : ''}`}>
        {label}
      </th>
      <td className={`num py-1.5 text-right ${total ? 'font-semibold' : ''} ${tone === 'income' ? 'font-semibold text-income' : ''}`}>
        {amount(cents)}
      </td>
    </tr>
  )
}
