import { CalendarClock, Info } from 'lucide-react'
import { useState } from 'react'
import { FAMILY_BG } from '../../components/machines/MachineArt'
import StatePill from '../../components/StatePill'
import { upcoming, type Machine } from '../../engine/machines'
import { day, dayMonth } from '../../lib/format'

/**
 * One machine, compactly: its status, what it runs from today in order, the
 * open POs each run is making, and when it stops.
 */
const STATUS: Record<string, { label: string; tone: string }> = {
  running: { label: 'Running', tone: 'bg-income-wash text-income' },
  changing: { label: 'Mould changing', tone: 'bg-caution-wash text-caution' },
  stopped: { label: 'Stopped', tone: 'bg-mist text-press-2' },
  offline: { label: 'Offline', tone: 'bg-mist text-press-2' },
  unscheduled: { label: 'No plan yet', tone: 'bg-mist text-press-2' },
}

/** POs listed per run before the rest fold behind a button. */
const FIRST = 2

const NO_PO = /no po|po required/i

export default function MachineRow({ machine: m, today }: { machine: Machine; today: string }) {
  const [open, setOpen] = useState<Record<number, boolean>>({})
  const bars = upcoming(m, today)
  const status = bars.length === 0 && m.status === 'running' ? STATUS.stopped : STATUS[m.status]

  return (
    <article className="flex flex-col rounded-card border border-rule bg-sheet p-4 shadow-card">
      <header className="flex items-start justify-between gap-2">
        <div>
          <h3 className="condensed text-title font-bold leading-tight">{m.name}</h3>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-small font-semibold ${status.tone}`}>{status.label}</span>
      </header>

      {bars.length === 0 && (
        <p className="mt-3 text-small text-press-2">{m.note ?? (m.stops ? `Stopped ${day(m.stops)}` : 'No runs on the plan yet')}</p>
      )}

      <ol className="mt-3 space-y-3">
        {bars.map((b, i) => {
          const r = b.run
          const shown = open[i] ? r.serves : r.serves.slice(0, FIRST)
          return (
            <li key={`${b.product}-${b.from}`} className={i > 0 ? 'border-t border-rule pt-3' : ''}>
              <p className="flex items-baseline gap-2">
                <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-sm ${FAMILY_BG[b.family]}`} aria-hidden />
                <span className="font-semibold">{b.product}</span>
                {i === 0 && b.from <= today && <span className="text-small font-semibold text-income">Now</span>}
              </p>
              <p className="ml-[1.125rem] text-small text-press-2">
                {r.from === null || r.from <= today ? 'Running' : `From ${dayMonth(r.from)}`}
                {r.until === null ? ', no end date' : ` to ${dayMonth(b.to)}`}
              </p>
              {r.note && (
                <p className={`ml-[1.125rem] text-small font-semibold ${NO_PO.test(r.note) ? 'text-caution' : 'text-press-2'}`}>{r.note}</p>
              )}
              {r.serves.length > 0 ? (
                <ul className="ml-[1.125rem] mt-1.5 space-y-1">
                  {shown.map((s) => (
                    <li key={s.po.po} className="rounded bg-mist px-2 py-1.5 text-small">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="font-semibold">PO {s.po.po}</span>
                        <StatePill state={s.po.state} />
                        {s.po.readyDate && <span className="text-press-2">ready {dayMonth(s.po.readyDate)}</span>}
                      </span>
                      {s.quantities.map((q) => (
                        <span key={q.label} className="block">
                          {q.quantity} <span className="text-press-2">{q.label}</span>
                        </span>
                      ))}
                    </li>
                  ))}
                  {r.serves.length > FIRST && (
                    <li>
                      <button
                        type="button"
                        aria-expanded={Boolean(open[i])}
                        onClick={() => setOpen((o) => ({ ...o, [i]: !o[i] }))}
                        className="min-h-[36px] text-small font-semibold text-info underline underline-offset-2"
                      >
                        {open[i] ? 'Show fewer' : `Show all ${r.serves.length} POs`}
                      </button>
                    </li>
                  )}
                </ul>
              ) : NO_PO.test(r.note ?? '') ? null : (
                <p className="ml-[1.125rem] mt-1 flex items-center gap-1.5 text-small text-press-2">
                  <Info size={13} aria-hidden /> No open Polyco PO on efdashboard.com
                </p>
              )}
            </li>
          )
        })}
      </ol>

      {m.stops && m.stops >= today && (
        <p className="mt-3 flex items-center gap-1.5 self-start rounded bg-caution-wash px-2.5 py-1.5 text-small font-semibold text-caution">
          <CalendarClock size={14} aria-hidden /> Stops {day(m.stops)}
          {m.stopNote ? `: ${m.stopNote}` : ''}
        </p>
      )}
      {m.note && bars.length > 0 && <p className="mt-2 text-small text-press-2">{m.note}</p>}
    </article>
  )
}
