import { CalendarClock, PauseCircle, Repeat, Wrench } from 'lucide-react'
import { agenda, nowOf, type Machine } from '../../engine/machines'
import { day, dayRange } from '../../lib/format'
import { Orders, StatusPill, Swatch, when } from './parts'

/**
 * One machine: its status, what it runs from today in order with any idle
 * stretch between, the orders each run is for, and when it stops.
 */
export default function MachineCard({ machine: m, today, live }: { machine: Machine; today: string; live: boolean }) {
  const now = nowOf(m, today)
  const items = agenda(m, today)
  const maintenance = m.status === 'maintenance'

  return (
    <article id={`m-${m.id}`} className="flex h-full scroll-mt-4 flex-col rounded-card border border-rule bg-sheet p-4 shadow-card">
      <header className="flex items-start justify-between gap-2">
        <h3 className="condensed text-title font-bold leading-tight">{m.name}</h3>
        <StatusPill now={now} />
      </header>

      {maintenance && m.note && (
        <p className="mt-3 flex gap-2 rounded bg-caution-wash px-2.5 py-2 text-small font-semibold text-caution">
          <Wrench size={14} strokeWidth={2.5} aria-hidden className="mt-px shrink-0" />
          {m.note}
        </p>
      )}

      {items.length === 0 && (
        <p className="mt-3 text-small text-press-2">
          {now.state === 'no-plan' ? 'The plan gives this machine no runs yet.' : m.stops ? `Stopped ${day(m.stops)}${m.stopNote ? `: ${m.stopNote}` : ''}` : 'Nothing left to run on the plan.'}
        </p>
      )}

      <ol className="mt-3 space-y-3">
        {items.map((item, i) =>
          item.kind === 'idle' ? (
            <li key={`idle-${item.from}`} className={`flex items-center gap-1.5 text-small font-semibold text-press-2 ${i > 0 ? 'border-t border-rule pt-3' : ''}`}>
              <PauseCircle size={14} aria-hidden /> Idle {dayRange(item.from, item.to)}
            </li>
          ) : (
            <li key={`${item.bar.product}-${item.bar.from}`} className={i > 0 ? 'border-t border-rule pt-3' : ''}>
              <p className="flex flex-wrap items-baseline gap-x-2">
                <Swatch family={item.bar.family} className="translate-y-px" />
                <span className="font-semibold">{item.bar.product}</span>
                {i === 0 && item.bar.from <= today && (
                  <span className={`text-small font-semibold ${maintenance ? 'text-caution' : 'text-income'}`}>{maintenance ? 'After maintenance' : 'Now'}</span>
                )}
              </p>
              <p className="ml-[1.125rem] text-small text-press-2">{when(item.bar, today, maintenance)}</p>
              {item.bar.run.note && <p className="ml-[1.125rem] text-small text-press-2">{item.bar.run.note}</p>}
              <div className="ml-[1.125rem] mt-1.5">
                <Orders run={item.bar.run} live={live} />
              </div>
            </li>
          ),
        )}
      </ol>

      <div className="mt-auto pt-3">
        {m.stops && m.stops >= today ? (
          <p className="inline-flex items-center gap-1.5 rounded bg-mist px-2.5 py-1.5 text-small font-semibold text-press">
            <CalendarClock size={14} aria-hidden /> Stops {day(m.stops)}
            {m.stopNote ? `: ${m.stopNote}` : ''}
          </p>
        ) : !m.stops && items.length > 0 ? (
          <p className="inline-flex items-center gap-1.5 rounded bg-mist px-2.5 py-1.5 text-small font-semibold text-press">
            <Repeat size={14} aria-hidden /> Runs on: no stop date on the plan
          </p>
        ) : null}
      </div>
    </article>
  )
}
