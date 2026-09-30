import { CalendarClock, Flag, TrendingUp } from 'lucide-react'
import Badge from '../../components/Badge'
import CategoryBar from '../../components/CategoryBar'
import { CategoryIcon } from '../../components/categoryStyle'
import type { Statement } from '../../engine/funds'
import { monthLong, range, usd } from '../../lib/format'

/**
 * One month at a glance: what was asked for, how the costs split across the
 * categories, and anything that reduced the request, in green so it stands out.
 * The whole card is the button that opens the month.
 */
export default function MonthCard({ s, onOpen }: { s: Statement; onOpen: () => void }) {
  const credits = s.lines.filter((l) => l.cents < 0).reduce((a, l) => a - l.cents, 0)
  const flagged = s.notes.some((n) => /^exception:/i.test(n))

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-haspopup="dialog"
      className={`flex h-full w-full flex-col rounded-card border bg-sheet p-4 text-left shadow-card transition-shadow hover:shadow-lift ${
        s.isRequest ? 'border-rule' : 'border-dashed border-press-2'
      }`}
    >
      <p className="text-small text-press-2">{range(s.periodStart, s.periodEnd)}</p>
      <h3 className="condensed text-title font-bold">{monthLong(s.id)}</h3>

      <p className="mt-3 text-small text-press-2">{s.isRequest ? 'Requested' : 'Spent, not a request'}</p>
      <p className={`num text-figure font-bold ${s.isRequest ? 'text-press' : 'text-press-2'}`}>{usd(s.statedCents)}</p>

      <div className="mt-3">
        <CategoryBar groups={s.groups} />
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {s.groups
          .filter((g) => g.cents > 0)
          .map((g) => (
            <CategoryIcon key={g.category} category={g.category} size={24} />
          ))}
      </div>

      {(s.incomeCents > 0 || credits > 0 || !s.isRequest || flagged) && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {s.incomeCents > 0 && (
            <Badge tone="income" Icon={TrendingUp}>
              {usd(s.incomeCents)} other income
            </Badge>
          )}
          {credits > 0 && (
            <Badge tone="income" Icon={TrendingUp}>
              {usd(credits)} credit
            </Badge>
          )}
          {!s.isRequest && <Badge Icon={CalendarClock}>Actuals</Badge>}
          {flagged && (
            <Badge tone="caution" Icon={Flag}>
              Flagged
            </Badge>
          )}
        </div>
      )}
    </button>
  )
}
