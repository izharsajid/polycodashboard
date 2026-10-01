import { CalendarClock, Info, PackageCheck } from 'lucide-react'
import { useState } from 'react'
import MachineArt, { FAMILY_BG } from '../../components/machines/MachineArt'
import StatePill from '../../components/StatePill'
import { daysIn, type MachineMonth } from '../../engine/machines'
import { day } from '../../lib/format'

/**
 * One machine in one month: its drawing, its status, a day-by-day bar of what it
 * runs, and the open POs each run is making.
 */
const STATUS: Record<string, { label: string; tone: string }> = {
  running: { label: 'Running', tone: 'bg-income-wash text-income' },
  changing: { label: 'Mould changing', tone: 'bg-caution-wash text-caution' },
  stopped: { label: 'Stopped', tone: 'bg-mist text-press-2' },
  offline: { label: 'Offline', tone: 'bg-mist text-press-2' },
}

/** POs listed per run before the rest fold behind a button. */
const FIRST = 3

export default function MachineCard({ mm, month, today }: { mm: MachineMonth; month: string; today: string }) {
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const m = mm.machine
  const n = daysIn(month)
  const pct = (d: number) => `${((d - 1) / n) * 100}%`
  const width = (a: number, b: number) => `${((b - a + 1) / n) * 100}%`
  const todayDay = today.startsWith(month) ? Number(today.slice(8, 10)) : null
  const idleAll = !mm.active
  const status = idleAll && m.status === 'running' ? STATUS.stopped : STATUS[m.status]
  const nowFamily = mm.segments[0]?.family ?? null

  return (
    <article className={`flex h-full flex-col rounded-card border bg-sheet p-4 shadow-card ${idleAll ? 'border-dashed border-rule opacity-80' : 'border-rule'}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="condensed text-title font-bold">{m.name}</h3>
          <p className="text-small text-press-2">{m.source === 'plan' ? 'Production plan' : 'Live from efdashboard.com'}</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-small font-semibold ${status.tone}`}>{status.label}</span>
      </div>

      <MachineArt type={m.type} status={idleAll ? 'stopped' : m.status} family={nowFamily} className="my-2 w-full" />

      {/* The month, day by day */}
      <div aria-hidden>
        <div className="relative h-7 overflow-hidden rounded bg-mist">
          {mm.segments.map((s) => (
            <span
              key={s.product + s.fromDay}
              className={`absolute inset-y-0 ${FAMILY_BG[s.family]} border-r-2 border-sheet`}
              style={{ left: pct(s.fromDay), width: width(s.fromDay, s.toDay), printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}
              title={`${s.product}, ${s.fromDay} to ${s.toDay}`}
            />
          ))}
          {mm.stopDay && <span className="absolute inset-y-0 w-0.5 bg-press" style={{ left: pct(mm.stopDay + 1) }} />}
          {todayDay && <span className="absolute -top-0 bottom-0 w-0.5 bg-marking" style={{ left: pct(todayDay) }} />}
        </div>
        <div className="mt-0.5 flex justify-between text-small text-press-2">
          <span>1</span>
          <span>{Math.round(n / 2)}</span>
          <span>{n}</span>
        </div>
      </div>

      {/* Runs in words */}
      <ul className="mt-3 space-y-3 text-table">
        {mm.runs.map((r) => (
          <li key={r.product}>
            <p className="flex items-center gap-2 font-semibold">
              <span className={`inline-block h-3 w-3 shrink-0 rounded-sm ${FAMILY_BG[r.family]}`} aria-hidden />
              {r.product}
            </p>
            <p className="ml-5 text-small text-press-2">
              {r.from ? `From ${day(r.from)}` : 'Already running'}
              {r.until ? `, until ${day(r.until)}` : ', no end date'}
            </p>
            {r.serves.length > 0 ? (
              <ul className="ml-5 mt-1.5 space-y-1">
                {(open[r.product] ? r.serves : r.serves.slice(0, FIRST)).map((s) => (
                  <li key={s.po.po} className="rounded bg-mist px-2 py-1.5">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="font-semibold">PO {s.po.po}</span>
                      <StatePill state={s.po.state} />
                    </span>
                    {s.quantities.map((q) => (
                      <span key={q.label} className="block text-small">
                        {q.quantity} <span className="text-press-2">{q.label}</span>
                      </span>
                    ))}
                    {s.po.readyDate && <span className="block text-small text-press-2">Cargo ready {day(s.po.readyDate)}</span>}
                  </li>
                ))}
                {r.serves.length > FIRST && (
                  <li>
                    <button
                      type="button"
                      aria-expanded={Boolean(open[r.product])}
                      onClick={() => setOpen((o) => ({ ...o, [r.product]: !o[r.product] }))}
                      className="min-h-[36px] text-small font-semibold text-info underline underline-offset-2"
                    >
                      {open[r.product] ? 'Show fewer' : `Show all ${r.serves.length} POs`}
                    </button>
                  </li>
                )}
              </ul>
            ) : (
              <p className="ml-5 mt-1 flex items-center gap-1.5 text-small text-press-2">
                <Info size={13} aria-hidden /> No open Polyco PO on efdashboard.com for this product
              </p>
            )}
          </li>
        ))}
      </ul>

      {mm.stopDay && (
        <p className="mt-3 flex items-center gap-1.5 rounded bg-caution-wash px-2.5 py-1.5 text-small font-semibold text-caution">
          <CalendarClock size={14} aria-hidden /> Stops {day(m.stops!)}
          {m.stopNote ? `: ${m.stopNote}` : ''}
        </p>
      )}
      {idleAll && (
        <p className="mt-3 flex items-center gap-1.5 text-small text-press-2">
          <PackageCheck size={14} aria-hidden /> {m.status === 'offline' ? 'Offline this month' : 'Not running this month'}
        </p>
      )}
      {m.note && <p className="mt-2 text-small text-press-2">{m.note}</p>}
    </article>
  )
}
