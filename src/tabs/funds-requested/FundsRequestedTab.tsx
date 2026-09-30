import { useMemo } from 'react'
import { buildModel } from '../../engine/funds'
import type { FundsRequestedT } from '../../engine/schema'
import { useFundsData } from '../../data/useFundsData'
import { day, monthLong, usd } from '../../lib/format'
import MonthlyChart from './MonthlyChart'
import MonthTable from './MonthTable'

/**
 * Tab 1, Funds Requested. What EcoFibre has asked Polyco for, month by month.
 * One headline, one chart, one table; every month opens to its lines.
 */
export default function FundsRequestedTab() {
  const funds = useFundsData()

  if (funds.status === 'loading') {
    return (
      <p className="mt-8 text-body text-press-2" aria-busy="true">
        Loading the statements.
      </p>
    )
  }
  if (funds.status === 'failed') {
    return (
      <p role="alert" className="mt-8 max-w-prose border-l-3 border-alert bg-sheet py-3 pl-4 pr-4 text-body text-alert">
        {funds.error}
      </p>
    )
  }
  return <FundsRequested data={funds.data} />
}

function FundsRequested({ data }: { data: FundsRequestedT }) {
  const model = useMemo(() => buildModel(data, __BUILD_DATE__), [data])

  return (
    <div className="space-y-8 pt-6 print:space-y-5 print:pt-2">
      <header className="card border-t-3 border-t-press px-4 py-5 sm:px-6">
        <h1 className="title text-title uppercase tracking-wide">Funds requested</h1>
        <p className="mt-1 text-table text-press-2">
          Financial Overview statements issued by Eco Fibre Bahrain W.L.L. to Polyco Healthline Ltd
        </p>
        <p className="mt-4 max-w-[40ch] text-title font-semibold leading-snug sm:text-display sm:leading-tight print:max-w-none print:text-title">
          {model.headline}
        </p>
        <p className="mt-2 max-w-prose text-table text-press-2">
          {usd(model.requestedCents)} requested in total.{' '}
          {model.excluded
            .map((s) => `${monthLong(s.id)} records actual spending, not a request, so it is not counted.`)
            .join(' ')}{' '}
          As at {day(model.asAt)}.
        </p>
      </header>

      <section className="section" aria-labelledby="chart-title">
        <h2 id="chart-title" className="title">Requested each month</h2>
        <figure className="mt-4 card px-3 pb-3 pt-4 sm:px-4 print:mt-2">
          <MonthlyChart model={model} />
        </figure>
      </section>

      <section className="section" aria-labelledby="months-title">
        <h2 id="months-title" className="title">Month by month</h2>
        <p className="lede no-print mt-1">Open a month to see its lines as issued.</p>
        <div className="mt-4 card px-4 py-2 sm:px-6">
          <MonthTable model={model} />
        </div>
      </section>
    </div>
  )
}
