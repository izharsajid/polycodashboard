import { ChevronLeft, ChevronRight, TriangleAlert } from 'lucide-react'
import { CATEGORY_LABEL } from '../../engine/classify'
import { kindLabel, type Model, type Statement } from '../../engine/funds'
import { amount, day, monthLong, range } from '../../lib/format'
import { CATEGORY_STYLE } from './categoryStyle'
import KindStamp from './KindStamp'
import Swatch from './Swatch'

/**
 * One statement, line by line, as issued. Every line, remark and note is shown
 * as written. The total is the statement's own stated total.
 */
type Props = { model: Model; statement: Statement; onSelect: (id: string) => void }

export default function StatementDetail({ model, statement: s, onSelect }: Props) {
  const at = model.statements.findIndex((x) => x.id === s.id)
  const prev = model.statements[at - 1]
  const next = model.statements[at + 1]
  const notes = s.notes.filter((n) => !/^exception:/i.test(n))

  return (
    <article aria-labelledby="statement-title">
      <header className="keep-together">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 id="statement-title" className="title">{monthLong(s.id)} statement</h3>
            <div className="mt-1.5">
              <KindStamp kind={s.kind} />
            </div>
          </div>
          <div className="no-print flex shrink-0 gap-1">
            <button
              type="button"
              className="btn-secondary px-2"
              disabled={!prev}
              onClick={() => prev && onSelect(prev.id)}
              aria-label={prev ? `Previous: ${monthLong(prev.id)} statement` : 'No earlier statement'}
            >
              <ChevronLeft size={18} aria-hidden />
            </button>
            <button
              type="button"
              className="btn-secondary px-2"
              disabled={!next}
              onClick={() => next && onSelect(next.id)}
              aria-label={next ? `Next: ${monthLong(next.id)} statement` : 'No later statement'}
            >
              <ChevronRight size={18} aria-hidden />
            </button>
          </div>
        </div>

        <dl className="mt-4 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-table">
          <dt className="text-press-2">Period</dt>
          <dd>
            {range(s.periodStart, s.periodEnd)}, {s.days} days
            {!s.matchesMonth && (
              <span className="block text-press-2">Not the calendar month of {monthLong(s.id)}.</span>
            )}
          </dd>
          <dt className="text-press-2">Prepared</dt>
          <dd>{s.prepared ? day(s.prepared) : <span className="text-press-2">Not stated on the statement</span>}</dd>
          <dt className="text-press-2">Lines</dt>
          <dd>{s.lines.length}</dd>
        </dl>

        {!s.isRequest && (
          <p className="mt-4 border-l-3 border-press-2 py-1 pl-3 text-table">
            This statement records spending after the fact. It is not a request, and it is not in any
            request total.
          </p>
        )}
        {s.kind === 'request_with_actuals' && (
          <p className="mt-4 border-l-3 border-press-2 py-1 pl-3 text-table">
            A request that also reports what was already spent. Hatched lines are marked utilised on the
            statement; solid lines are still required. The whole statement counts as a request.
          </p>
        )}

        {s.flags.map((flag) => (
          <div key={flag} role="note" className="mt-4 flex gap-2 border-2 border-press bg-sheet p-3 text-table">
            <TriangleAlert size={18} aria-hidden className="mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">Month labels on this statement are in doubt</p>
              <p className="mt-1">{flag}</p>
              <p className="mt-1 text-press-2">
                The amounts and the total are the same in both versions, so this statement counts in every
                total. Only the month named on individual lines is uncertain.
              </p>
            </div>
          </div>
        ))}
      </header>

      <table className="mt-5 w-full border-collapse">
        <caption className="sr-only">Lines on the {monthLong(s.id)} statement</caption>
        <thead>
          <tr>
            <th scope="col" className="th w-6 pl-0"><span className="sr-only">Category colour</span></th>
            <th scope="col" className="th">Line and remarks</th>
            <th scope="col" className="th text-right">US$</th>
          </tr>
        </thead>
        <tbody>
          {s.lines.map((l) => {
            const { Icon } = CATEGORY_STYLE[l.category]
            return (
              <tr key={l.index}>
                <td className="td pl-0 pt-3.5">
                  <Swatch category={l.category} hatched={l.utilised === true} />
                </td>
                <td className="td">
                  <span className="block">{l.description}</span>
                  {l.remarks && <span className="mt-0.5 block text-small text-press-2">{l.remarks}</span>}
                  <span className="mt-1 flex items-center gap-1.5 text-small text-press-2">
                    <Icon size={13} aria-hidden className="shrink-0" />
                    {CATEGORY_LABEL[l.category]}
                  </span>
                </td>
                <td className="td num whitespace-nowrap text-right">
                  {amount(l.cents)}
                  {l.cents < 0 && <span className="block text-small text-press-2">credit</span>}
                </td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-press">
            <td />
            <th scope="row" className="px-3 py-2.5 text-left text-table font-semibold">
              Stated total
              <span className="block text-small font-normal text-press-2">{kindLabel(s.kind)}</span>
            </th>
            <td className="num whitespace-nowrap px-3 py-2.5 text-right align-top text-table font-semibold">
              {amount(s.statedCents)}
            </td>
          </tr>
        </tfoot>
      </table>

      {notes.length > 0 && (
        <section className="mt-5" aria-labelledby="statement-notes">
          <h4 id="statement-notes" className="text-table font-semibold">Notes on the statement</h4>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-table text-press-2">
            {notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </section>
      )}
    </article>
  )
}
