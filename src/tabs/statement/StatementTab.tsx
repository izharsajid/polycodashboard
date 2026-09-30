import { useMemo } from 'react'
import MonthBars from '../../components/MonthBars'
import { LedgerPayload } from '../../data/schemas'
import { useApiData } from '../../data/useApiData'
import { buildLedgerModel, type LedgerModel } from '../../engine/ledger'
import type { LedgerDisputesT, LedgerT } from '../../engine/ledgerSchema'
import { amount, day, monthLong, usd } from '../../lib/format'
import LedgerMonthTable from './LedgerMonthTable'
import UnresolvedTable from './UnresolvedTable'

/**
 * Tab 2, PHL/EcoFibre Statement. Every delivery, recharge and payment between
 * the two companies: the position, the balance month by month, and whatever is
 * not yet agreed, shown as unresolved rather than assumed.
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
      <p role="alert" className="mt-8 max-w-prose border-l-3 border-alert bg-sheet py-3 pl-4 pr-4 text-body text-alert">
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
  const unresolvedCount = model.unresolved.length

  return (
    <div className="space-y-8 pt-6 print:space-y-5 print:pt-2">
      <header className="card border-t-3 border-t-press px-4 py-5 sm:px-6">
        <h1 className="title text-title uppercase tracking-wide">PHL/EcoFibre statement</h1>
        <p className="mt-1 text-table text-press-2">
          Every delivery, recharge and payment between Eco Fibre Bahrain W.L.L. and Polyco Healthline Ltd
        </p>
        <p className="mt-4 max-w-[44ch] text-title font-semibold leading-snug sm:text-display sm:leading-tight print:max-w-none print:text-title">
          {model.headline}
        </p>
        <p className="mt-2 max-w-prose text-table text-press-2">
          As at {day(model.asAt)}. Money received from Polyco raises the balance and value delivered lowers it, so a
          positive balance is Polyco's money that EcoFibre holds and has not yet delivered as goods. Since June 2025
          Polyco has paid against EcoFibre's monthly funding statements, approved line by line.
        </p>
      </header>

      <section className="section" aria-labelledby="position-title">
        <h2 id="position-title" className="title">The position</h2>
        <div className="mt-4 card max-w-2xl px-4 py-3 sm:px-6">
          <table className="w-full border-collapse text-table">
            <caption className="sr-only">From money received to the uncovered advance</caption>
            <tbody>
              <BridgeRow label="Received from Polyco" cents={b.receivedCents} />
              <BridgeRow label="Less delivered to Polyco" cents={-b.deliveredCents} />
              <tr>
                <th scope="row" className="py-1 pl-4 text-left text-small font-normal text-press-2">
                  Of which cargo clearing and freight recharged, already included and not deducted again
                </th>
                <td className="num py-1 text-right text-small text-press-2">{amount(b.rechargesCents)}</td>
              </tr>
              <BridgeRow label="Balance held by EcoFibre" cents={b.balanceCents} total />
              <BridgeRow label="Less POs pending delivery" cents={-b.pendingPosCents} />
              <BridgeRow label="Less containers ready, next month" cents={-b.containersReadyCents} />
              <BridgeRow label="Less containers in process, the month after" cents={-b.containersInProcessCents} />
              <BridgeRow label="Uncovered advance" cents={b.uncoveredCents} total final />
            </tbody>
          </table>
        </div>
      </section>

      <section className="section" aria-labelledby="balance-title">
        <h2 id="balance-title" className="title">Balance at each month end</h2>
        <p className="lede mt-1 max-w-prose">
          From movements with a confirmed date. The {unresolvedCount} with a date not yet agreed, net{' '}
          {usd(model.unresolvedNetCents)}, are listed under Unresolved and added at the end.
        </p>
        <figure className="mt-4 card px-3 pb-3 pt-4 sm:px-4 print:mt-2">
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

      <section className="section" aria-labelledby="months-title">
        <h2 id="months-title" className="title">Month by month</h2>
        <p className="lede no-print mt-1">Open a month to see each delivery and payment in it.</p>
        <div className="mt-4 card px-4 py-2 sm:px-6">
          <LedgerMonthTable model={model} />
        </div>
      </section>

      <section className="section" aria-labelledby="unresolved-title">
        <h2 id="unresolved-title" className="title">Unresolved</h2>
        <p className="lede mt-1 max-w-prose">
          {unresolvedCount} {unresolvedCount === 1 ? 'movement has' : 'movements have'} a date nobody has confirmed, so
          none is placed in a month. {model.unattributed.count} receipts totalling {usd(model.unattributed.cents)} are
          lump sums not tied to any PO; each is marked unattributed in its month.
        </p>
        <div className="mt-4 card px-4 py-2 sm:px-6">
          <UnresolvedTable movements={model.unresolved} />
        </div>
      </section>
    </div>
  )
}

function BridgeRow({ label, cents, total = false, final = false }: { label: string; cents: number; total?: boolean; final?: boolean }) {
  const rule = final ? 'border-t-2 border-b-2 border-press' : total ? 'border-t-2 border-press' : ''
  return (
    <tr className={rule}>
      <th scope="row" className={`py-2 text-left ${total ? 'font-semibold' : 'font-normal'}`}>{label}</th>
      <td className={`num py-2 text-right ${total ? 'font-semibold' : ''}`}>{amount(cents)}</td>
    </tr>
  )
}
