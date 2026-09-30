import { CATEGORY_LABEL, type Category } from '../../engine/classify'
import { statementName, type Model, type Statement } from '../../engine/funds'
import { amount, percent, usd } from '../../lib/format'
import { CATEGORY_STYLE } from './categoryStyle'
import Sparkline from './Sparkline'
import Swatch from './Swatch'

/**
 * What the money is spent on, and how that has moved: every category's share of
 * the request total, what the selected statement asked for in it, and its line
 * across the requests. A table, because this is a comparison across categories,
 * never a pie.
 */
type Props = { model: Model; selected: Statement; active: ReadonlySet<Category> }

export default function CategoryTable({ model, selected, active }: Props) {
  const markIndex = model.requests.findIndex((s) => s.id === selected.id)
  return (
    <div>
      <table className="w-full border-collapse">
        <caption className="sr-only">
          Each category's total across the {model.requestCount} requests, its share, and the selected statement's amount
        </caption>
        <thead>
          <tr>
            <th scope="col" className="th pl-0">Category</th>
            <th scope="col" className="th px-1.5 text-right sm:px-3">
              <span className="hidden sm:inline">Requested, {model.requestCount} requests (US$)</span>
              <span className="sm:hidden">Requested (US$)</span>
            </th>
            <th scope="col" className="th px-1.5 text-right sm:px-3">Share</th>
            <th scope="col" className="th px-1.5 text-right sm:px-3">
              <span className="hidden sm:inline">{statementName(selected)} (US$)</span>
              <span className="sm:hidden">Selected (US$)</span>
            </th>
            <th scope="col" className="th hidden md:table-cell">Across the requests</th>
          </tr>
        </thead>
        <tbody>
          {model.categoryTotals.map((t) => {
            const { Icon } = CATEGORY_STYLE[t.category]
            const inChart = active.has(t.category)
            return (
              <tr key={t.category} className={inChart ? '' : 'text-press-2'}>
                <th scope="row" className="td pl-0 pr-1.5 text-left font-normal sm:pr-3">
                  <span className="flex items-center gap-2">
                    <Swatch category={t.category} />
                    <Icon size={15} aria-hidden className="hidden shrink-0 sm:block" />
                    <span>
                      {CATEGORY_LABEL[t.category]}
                      {!inChart && <span className="block text-small">Switched off in the chart</span>}
                    </span>
                  </span>
                </th>
                <td className="td num px-1.5 text-right sm:px-3">{amount(t.cents)}</td>
                <td className="td num px-1.5 text-right sm:px-3">{percent(t.share)}</td>
                <td className="td num px-1.5 text-right sm:px-3">{amount(selected.byCategory[t.category])}</td>
                <td className="td hidden py-1 md:table-cell">
                  <Sparkline
                    category={t.category}
                    values={t.series.map((p) => p.cents)}
                    mark={markIndex >= 0 ? markIndex : null}
                  />
                </td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-press">
            <th scope="row" className="px-3 py-2.5 pl-0 text-left text-table font-semibold">Total requested</th>
            <td className="num px-1.5 py-2.5 text-right text-table font-semibold sm:px-3">{amount(model.requestedCents)}</td>
            <td className="num px-1.5 py-2.5 text-right text-table sm:px-3">{percent(1)}</td>
            <td className="num px-1.5 py-2.5 text-right text-table font-semibold sm:px-3">{amount(selected.statedCents)}</td>
            <td className="hidden md:table-cell" />
          </tr>
        </tfoot>
      </table>
      {model.excluded.length > 0 && (
        <p className="mt-3 max-w-prose text-small text-press-2">
          Shares are of {usd(model.requestedCents)}, the {model.requestCount} requests.{' '}
          {model.excluded
            .map((s) => `The ${statementName(s)} (${usd(s.statedCents)}) records actual spending and is not included.`)
            .join(' ')}
          {!selected.isRequest && ' The selected statement is shown for comparison only.'}
        </p>
      )}
    </div>
  )
}
