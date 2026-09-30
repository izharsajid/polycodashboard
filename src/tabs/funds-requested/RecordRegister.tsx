import { CalendarOff, CalendarRange, FileQuestion, type LucideIcon } from 'lucide-react'
import { statementName, type Model } from '../../engine/funds'
import { monthLong, range } from '../../lib/format'

/**
 * Every gap, overlap and missing date in the statement record, each with a way
 * to the statement it concerns. A reader who finds an irregularity for
 * themselves trusts the page less than one who was told.
 */
type Props = { model: Model; onSelect: (id: string) => void }

type Row = { key: string; Icon: LucideIcon; what: string; when: string; meaning: string; statementId: string }

export default function RecordRegister({ model, onSelect }: Props) {
  const name = (id: string) => monthLong(id)
  const rows: Row[] = [
    ...model.gaps.map((g) => ({
      key: `gap-${g.start}`,
      Icon: CalendarOff,
      what: 'Gap',
      when: `${range(g.start, g.end)}, ${g.days} ${g.days === 1 ? 'day' : 'days'}`,
      meaning: g.reason,
      statementId: g.statementId,
    })),
    ...model.overlaps.map((o) => ({
      key: `overlap-${o.start}`,
      Icon: CalendarRange,
      what: 'Overlap',
      when: `${range(o.start, o.end)}, ${o.days} days`,
      meaning: `Claimed by both the ${o.statementIds.map(name).join(' and the ')} statements.`,
      statementId: o.statementIds[0],
    })),
    ...model.undated.map((s) => ({
      key: `undated-${s.id}`,
      Icon: FileQuestion,
      what: 'No prepared date',
      when: range(s.periodStart, s.periodEnd),
      meaning: `The ${statementName(s)} does not state when it was prepared.`,
      statementId: s.id,
    })),
  ]

  return (
    <table className="w-full border-collapse">
      <caption className="sr-only">Gaps, overlaps and missing prepared dates in the statement record</caption>
      <thead>
        <tr>
          <th scope="col" className="th pl-0">Finding</th>
          <th scope="col" className="th">Dates</th>
          <th scope="col" className="th hidden md:table-cell">What it means</th>
          <th scope="col" className="th no-print"><span className="sr-only">Statement</span></th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.key}>
            <th scope="row" className="td pl-0 text-left font-semibold">
              <span className="flex items-center gap-2">
                <r.Icon size={15} aria-hidden className="shrink-0" />
                {r.what}
              </span>
            </th>
            <td className="td">
              {r.when}
              <span className="mt-0.5 block text-small text-press-2 md:hidden">{r.meaning}</span>
            </td>
            <td className="td hidden text-press-2 md:table-cell">{r.meaning}</td>
            <td className="td no-print text-right">
              <button
                type="button"
                className="btn-text"
                onClick={() => onSelect(r.statementId)}
                aria-label={`Show the ${name(r.statementId)} statement`}
              >
                Show {name(r.statementId)}
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
