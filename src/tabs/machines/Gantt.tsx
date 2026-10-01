import { useEffect, useRef, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { FAMILY_BG } from '../../components/machines/MachineArt'
import { addDays, dayNumber, timeline, type Bar, type Machine } from '../../engine/machines'
import { dayMonth, monthOnly } from '../../lib/format'

/**
 * Every machine on one time axis: a row per machine, grouped by kind, a bar per
 * run in its product's colour, a tick where the machine stops, and today.
 * Hover or focus a bar for the product, its dates and its POs.
 */
export type GanttGroup = { title: string; Icon: LucideIcon; machines: Machine[] }

type Tip = { key: string; bar: Bar; left: number }

/** A name short enough for the chart's label column; the group heading says the kind. */
export const shortName = (name: string) => name.replace(/ Machine\b/, '').replace(/^(Manual|Auto) Trimmer\b/, '$1')

export default function Gantt({
  groups,
  span,
  months,
  today,
}: {
  groups: GanttGroup[]
  span: { from: string; to: string }
  months: string[]
  today: string
}) {
  const [tip, setTip] = useState<Tip | null>(null)
  const total = dayNumber(span.to) - dayNumber(span.from) + 1
  const at = (iso: string) => ((dayNumber(iso) - dayNumber(span.from)) / total) * 100
  const showToday = today >= span.from && today <= span.to

  // On a narrow screen the chart scrolls sideways: open it at today.
  const scroller = useRef<HTMLDivElement>(null)
  const track = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const box = scroller.current
    if (!box || !track.current || !showToday || box.scrollWidth <= box.clientWidth) return
    box.scrollLeft = Math.max(0, (at(today) / 100) * track.current.clientWidth - 24)
    // Only on first draw; after that the reader scrolls.
  }, [])

  const grid = (
    <>
      {months.slice(1).map((m) => (
        <span key={m} className="absolute inset-y-0 w-px bg-rule" style={{ left: `${at(`${m}-01`)}%` }} aria-hidden />
      ))}
      {showToday && <span className="absolute inset-y-0 z-[1] w-0.5 bg-marking" style={{ left: `${at(today)}%` }} aria-hidden />}
    </>
  )

  return (
    <div ref={scroller} className="-mx-1 overflow-x-auto px-1 pb-1">
      <div className="min-w-[640px]">
        {/* Month axis */}
        <div className="grid grid-cols-[6.5rem_1fr] sm:grid-cols-[8.5rem_1fr] items-end gap-3 pb-1.5">
          <span />
          <div ref={track} className="relative h-5 text-small font-semibold text-press-2">
            {months.map((m, i) => (
              <span key={m} className="absolute pl-1.5" style={{ left: `${at(`${m}-01`)}%` }}>
                {monthOnly(m)}
                {i === 0 || m.endsWith('-01') ? ` ${m.slice(0, 4)}` : ''}
              </span>
            ))}
          </div>
        </div>

        {groups.map(({ title, Icon, machines }) => (
          <div key={title} role="group" aria-label={title} className="mt-2">
            <p className="border-b border-rule pb-1 text-small font-bold uppercase tracking-wide text-press-2">
              <span className="sticky left-0 inline-flex items-center gap-1.5">
                <Icon size={14} aria-hidden /> {title}
              </span>
            </p>
            <ul>
              {machines.map((m) => {
                const bars = timeline(m, span)
                return (
                  <li key={m.id} className="grid grid-cols-[6.5rem_1fr] sm:grid-cols-[8.5rem_1fr] items-center gap-3 py-1">
                    <span className="sticky left-0 z-[3] -my-1 self-stretch truncate bg-sheet py-1 pr-1 text-table font-semibold leading-7">
                      {shortName(m.name)}
                    </span>
                    <div className="relative h-7 rounded bg-mist">
                      {grid}
                      {bars.length === 0 && (
                        <span className="absolute inset-0 flex items-center pl-2 text-small text-press-2">
                          {m.status === 'offline' ? 'Offline' : 'Nothing planned'}
                        </span>
                      )}
                      {bars.map((b, i) => {
                        const key = `${m.id}-${i}`
                        const left = at(b.from)
                        const width = at(addDays(b.to, 1)) - left
                        return (
                          <button
                            key={key}
                            type="button"
                            aria-label={`${m.name}: ${b.product}, ${label(b)}`}
                            onMouseEnter={() => setTip({ key, bar: b, left })}
                            onMouseLeave={() => setTip(null)}
                            onFocus={() => setTip({ key, bar: b, left })}
                            onBlur={() => setTip(null)}
                            className={`absolute inset-y-1 border-x border-sheet ${FAMILY_BG[b.family]} ${b.startsBefore ? 'rounded-l-none' : 'rounded-l'} ${b.runsOn ? 'rounded-r-none' : 'rounded-r'} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-press`}
                            style={{ left: `${left}%`, width: `${width}%`, printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}
                          >
                            {/* The product named on a white chip, readable on every product colour. */}
                            {width > 6 && (
                              <span className="absolute inset-y-0.5 left-1 z-[2] flex max-w-[calc(100%-0.5rem)] items-center overflow-hidden rounded-[4px] bg-sheet/90 px-1.5 text-[11px] font-semibold leading-none text-press">
                                <span className="truncate">{b.product}</span>
                              </span>
                            )}
                          </button>
                        )
                      })}
                      {m.stops && m.stops >= span.from && m.stops <= span.to && (
                        <span
                          className="absolute -inset-y-0.5 z-[1] w-[3px] rounded-sm bg-press"
                          style={{ left: `${at(addDays(m.stops, 1))}%` }}
                          aria-hidden
                        />
                      )}
                      {tip && tip.key.startsWith(`${m.id}-`) && <Tooltip tip={tip} />}
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}

const label = (b: Bar) =>
  `${b.startsBefore && b.run.from === null ? 'already running' : dayMonth(b.from)} to ${b.runsOn && b.run.until === null ? 'no end date' : dayMonth(b.to)}`

function Tooltip({ tip }: { tip: Tip }) {
  const { bar, left } = tip
  const pos = left > 55 ? { right: `${100 - left}%` } : { left: `${left}%` }
  const pos2 = bar.run.serves.map((s) => s.po.po)
  return (
    <div role="tooltip" className="pointer-events-none absolute bottom-full z-10 mb-1.5 w-max max-w-[260px] rounded-[8px] bg-press px-2.5 py-1.5 text-small text-sheet shadow-lift" style={pos}>
      <p className="font-semibold">{bar.product}</p>
      <p>{label(bar)}</p>
      {pos2.length > 0 && <p>PO {pos2.join(', ')}</p>}
      {bar.run.note && <p>{bar.run.note}</p>}
    </div>
  )
}
