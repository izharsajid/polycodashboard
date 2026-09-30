import { useId } from 'react'
import { CATEGORY_LABEL } from '../../engine/classify'
import { bridge, kindLabel, statementName, type Model, type Statement } from '../../engine/funds'
import { amount, monthLong, movement, usd } from '../../lib/format'
import { CATEGORY_STYLE } from './categoryStyle'
import Swatch from './Swatch'

/**
 * A bridge from one statement's total to another's, by category, largest
 * movement first. The reader picks the statement to compare against; the other
 * end is always the selected statement.
 *
 * The bars share one scale centred on no change, so their lengths compare
 * movement against movement. The totals are figures, not bars: drawn to the same
 * scale they would dwarf every movement into invisibility.
 */
type Props = {
  model: Model
  selected: Statement
  compare: Statement
  onCompare: (id: string) => void
}

export default function Comparison({ model, selected, compare, onCompare }: Props) {
  const selectId = useId()
  const b = bridge(compare, selected)
  const scale = Math.max(1, ...b.steps.map((s) => Math.abs(s.deltaCents)))
  let running = compare.statedCents

  return (
    <section aria-labelledby="compare-title">
      <h3 id="compare-title" className="title">Compared with another statement</h3>

      <div className="no-print mt-3">
        <label htmlFor={selectId} className="kicker block">
          Compare the {monthLong(selected.id)} statement with
        </label>
        <select
          id={selectId}
          className="field mt-1"
          value={compare.id}
          onChange={(e) => onCompare(e.target.value)}
        >
          {model.statements
            .filter((s) => s.id !== selected.id)
            .map((s) => (
              <option key={s.id} value={s.id}>
                {statementName(s)}
                {s.kind !== 'request' ? `, ${kindLabel(s.kind).toLowerCase()}` : ''}
              </option>
            ))}
        </select>
      </div>

      <p className="mt-3 text-table">
        {b.deltaCents === 0
          ? `The ${statementName(selected)} asks for the same total as the ${statementName(compare)}.`
          : `The ${statementName(selected)} is ${usd(Math.abs(b.deltaCents))} ${
              b.deltaCents > 0 ? 'higher' : 'lower'
            } than the ${statementName(compare)}.`}
      </p>

      <table className="mt-3 w-full border-collapse">
        <caption className="sr-only">Movement by category, largest first</caption>
        <thead>
          <tr>
            <th scope="col" className="th pl-0">Category</th>
            <th scope="col" className="th text-right">Movement (US$)</th>
            <th scope="col" className="th hidden text-right sm:table-cell">Running total</th>
            <th scope="col" className="th w-[34%]"><span className="sr-only">Size of movement</span></th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row" className="td pl-0 text-left font-semibold">{monthLong(compare.id)} total</th>
            <td className="td num text-right font-semibold">{amount(compare.statedCents)}</td>
            <td className="td num hidden text-right sm:table-cell">{amount(compare.statedCents)}</td>
            <td className="td" />
          </tr>
          {b.steps.map((step) => {
            running += step.deltaCents
            const share = Math.abs(step.deltaCents) / scale
            const { Icon } = CATEGORY_STYLE[step.category]
            return (
              <tr key={step.category}>
                <th scope="row" className="td pl-0 text-left font-normal">
                  <span className="flex items-center gap-2">
                    <Swatch category={step.category} />
                    <Icon size={14} aria-hidden className="hidden shrink-0 sm:block" />
                    {CATEGORY_LABEL[step.category]}
                  </span>
                </th>
                <td className="td num whitespace-nowrap text-right">{movement(step.deltaCents)}</td>
                <td className="td num hidden text-right text-press-2 sm:table-cell">{amount(running)}</td>
                <td className="td" aria-hidden>
                  <div className="relative h-3.5">
                    <div className="absolute inset-y-[-4px] left-1/2 w-px bg-press" />
                    <div
                      className={`absolute inset-y-0 ${CATEGORY_STYLE[step.category].bg}`}
                      style={{
                        width: `${share * 50}%`,
                        left: step.deltaCents >= 0 ? '50%' : `${50 - share * 50}%`,
                        printColorAdjust: 'exact',
                        WebkitPrintColorAdjust: 'exact',
                      }}
                    />
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-press">
            <th scope="row" className="px-3 py-2.5 pl-0 text-left text-table font-semibold">{monthLong(selected.id)} total</th>
            <td className="num px-3 py-2.5 text-right text-table font-semibold">{amount(selected.statedCents)}</td>
            <td className="num hidden px-3 py-2.5 text-right text-table sm:table-cell">{amount(running)}</td>
            <td />
          </tr>
        </tfoot>
      </table>

      {b.unchanged.length > 0 && (
        <p className="mt-2 text-small text-press-2">
          No change in {b.unchanged.map((c) => CATEGORY_LABEL[c].toLowerCase()).join(', ')}.
        </p>
      )}
      {(!compare.isRequest || !selected.isRequest) && (
        <p className="mt-2 text-small text-press-2">
          One side of this comparison records actuals rather than a request.
        </p>
      )}
    </section>
  )
}
