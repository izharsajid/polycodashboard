import { useMemo, useState } from 'react'
import { CATEGORY_STYLE } from '../../components/categoryStyle'
import { FundsPayload } from '../../data/schemas'
import { useApiData } from '../../data/useApiData'
import { CATEGORIES, CATEGORY_LABEL } from '../../engine/classify'
import { buildModel, type Statement } from '../../engine/funds'
import type { FundsRequestedT } from '../../engine/schema'
import MonthCard from './MonthCard'
import MonthPanel from './MonthPanel'

/**
 * Tab 1, Funds Requested. Every month EcoFibre has asked Polyco for, as a card,
 * newest first and grouped by year. A card opens into the month's full
 * statement.
 */
export default function FundsRequestedTab() {
  const funds = useApiData('/api/data', FundsPayload, 'statements')

  if (funds.status === 'loading') {
    return (
      <p className="mt-8 text-body text-press-2" aria-busy="true">
        Loading the statements.
      </p>
    )
  }
  if (funds.status === 'failed') {
    return (
      <p role="alert" className="mt-8 max-w-prose rounded-card border-l-3 border-alert bg-sheet py-3 pl-4 pr-4 text-body text-alert">
        {funds.error}
      </p>
    )
  }
  return <FundsRequested data={funds.data.funds} />
}

function FundsRequested({ data }: { data: FundsRequestedT }) {
  const model = useMemo(() => buildModel(data, __BUILD_DATE__), [data])
  const [openId, setOpenId] = useState<string | null>(null)
  const open: Statement | null = model.statements.find((s) => s.id === openId) ?? null

  const newestFirst = [...model.statements].reverse()
  const years = [...new Set(newestFirst.map((s) => s.id.slice(0, 4)))]

  return (
    <div className="space-y-8 pt-6">
      <header>
        <h1 className="condensed text-figure font-bold">Funds requested</h1>
        <p className="mt-1 text-table text-press-2">
          Financial Overview statements issued by Eco Fibre Bahrain W.L.L. to Polyco Healthline Ltd. Open a month
          to see every line.
        </p>
        <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-small text-press-2" aria-label="Category colours">
          {CATEGORIES.map((c) => {
            const { bg, Icon } = CATEGORY_STYLE[c]
            return (
              <li key={c} className="flex items-center gap-1.5">
                <span className={`inline-flex h-5 w-5 items-center justify-center rounded ${bg} text-sheet`} aria-hidden>
                  <Icon size={12} strokeWidth={2.5} />
                </span>
                {CATEGORY_LABEL[c]}
              </li>
            )
          })}
        </ul>
      </header>

      {years.map((year) => (
        <section key={year} aria-labelledby={`year-${year}`}>
          <h2 id={`year-${year}`} className="condensed mb-3 text-title font-bold text-press-2">
            {year}
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {newestFirst
              .filter((s) => s.id.startsWith(year))
              .map((s) => (
                <li key={s.id}>
                  <MonthCard s={s} onOpen={() => setOpenId(s.id)} />
                </li>
              ))}
          </ul>
        </section>
      ))}

      <MonthPanel s={open} onClose={() => setOpenId(null)} />
    </div>
  )
}
