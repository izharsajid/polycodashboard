import { Wrench, type LucideIcon } from 'lucide-react'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { FAMILY_BG } from '../../components/machines/MachineArt'
import { addDays, dayNumber, gaps, hasPo, inMonth, shiftMonth, timeline, type Bar, type Machine, type Order } from '../../engine/machines'
import { dayMonth, monthOnly } from '../../lib/format'
import { shortName } from './parts'

/**
 * Every machine on one time axis: a row per machine, grouped by kind, a bar per
 * run in its product's colour.
 * Idle stretches and the time after a machine stops are written in. Hover or
 * focus a bar for the product, its dates and its orders.
 */
export type GanttGroup = { title: string; Icon: LucideIcon; machines: Machine[] }

type Tip = { key: string; bar: Bar; left: number }

const PRINT_EXACT: CSSProperties = { printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }

export default function Gantt({
  groups,
  span,
  months,
  today,
  month,
}: {
  groups: GanttGroup[]
  span: { from: string; to: string }
  months: string[]
  today: string
  /** One month on its own: weekly ticks, and a column with the day each machine runs to. */
  month?: string
}) {
  const [tip, setTip] = useState<Tip | null>(null)
  const total = dayNumber(span.to) - dayNumber(span.from) + 1
  const at = (iso: string) => ((dayNumber(iso) - dayNumber(span.from)) / total) * 100
  const width = (from: string, to: string) => at(addDays(to, 1)) - at(from)
  const showToday = today >= span.from && today <= span.to
  const cols = month ? 'grid-cols-[6.5rem_1fr_5rem] sm:grid-cols-[8.5rem_1fr_6rem]' : 'grid-cols-[6.5rem_1fr] sm:grid-cols-[8.5rem_1fr]'
  // A month on its own is marked weekly; the whole plan, by month.
  const ticks = month ? ['08', '15', '22', '29'].map((d) => `${month}-${d}`) : months.slice(1).map((m) => `${m}-01`)

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
      {ticks.map((d) => (
        <span key={d} className="absolute inset-y-0 w-px bg-rule" style={{ left: `${at(d)}%` }} aria-hidden />
      ))}
      {showToday && <span className="absolute -inset-y-1 z-[4] w-0.5 bg-marking" style={{ left: `${at(today)}%`, ...PRINT_EXACT }} aria-hidden />}
    </>
  )

  return (
    <div ref={scroller} className="-mx-1 overflow-x-auto px-1 pb-1">
      <div className="min-w-[680px]">
        {/* Month axis */}
        <div className={`grid ${cols} items-end gap-3 pb-1.5`}>
          <span />
          <div ref={track} className="relative h-5 text-small font-semibold text-press-2">
            {month
              ? [`${month}-01`, ...ticks].map((d, i) => (
                  <span key={d} className="absolute pl-1.5" style={{ left: `${at(d)}%` }}>
                    {i === 0 ? dayMonth(d) : Number(d.slice(8))}
                  </span>
                ))
              : months.map((m, i) => (
                  <span key={m} className="absolute pl-1.5" style={{ left: `${at(`${m}-01`)}%` }}>
                    {monthOnly(m)}
                    {i === 0 || m.endsWith('-01') ? ` ${m.slice(0, 4)}` : ''}
                  </span>
                ))}
          </div>
          {month && <span className="text-small font-semibold text-press-2">Runs to</span>}
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
                const idle = gaps(m, span)
                // After its last day the machine stands stopped to the chart's edge.
                const stopped = m.stops && m.stops < span.to ? { from: m.stops < span.from ? span.from : addDays(m.stops, 1), to: span.to } : null
                return (
                  <li key={m.id} className={`grid ${cols} items-center gap-3 py-1`}>
                    <span className="sticky left-0 z-[5] -my-1 flex items-center gap-1.5 self-stretch bg-sheet py-1 pr-1 text-table font-semibold leading-7">
                      <a href={`#m-${m.id}`} className="truncate hover:underline">
                        {shortName(m.name)}
                      </a>
                      {m.status === 'maintenance' && (
                        <span className="inline-flex shrink-0 items-center text-caution" title="In maintenance">
                          <Wrench size={14} strokeWidth={2.5} aria-hidden />
                          <span className="sr-only">, in maintenance</span>
                        </span>
                      )}
                    </span>
                    <div className="relative h-8 rounded bg-mist">
                      {grid}
                      {bars.length === 0 && !stopped && (
                        <span className="absolute inset-0 flex items-center pl-2 text-small text-press-2">No plan yet</span>
                      )}
                      {idle.map((g) => (
                        <Stretch key={g.from} left={at(g.from)} width={width(g.from, g.to)} label="Idle" dashed />
                      ))}
                      {stopped && <Stretch left={at(stopped.from)} width={width(stopped.from, stopped.to)} label="Stopped" />}
                      {bars.map((b, i) => {
                        const key = `${m.id}-${i}`
                        const left = at(b.from)
                        const w = width(b.from, b.to)
                        return (
                          <button
                            key={key}
                            type="button"
                            aria-label={`${m.name}: ${b.product}, ${dates(b)}, ${ordersText(b.run.orders, hasPo(b.run))}`}
                            onMouseEnter={() => setTip({ key, bar: b, left })}
                            onMouseLeave={() => setTip(null)}
                            onFocus={() => setTip({ key, bar: b, left })}
                            onBlur={() => setTip(null)}
                            className={`absolute inset-y-1 border-x border-sheet ${FAMILY_BG[b.family]} ${b.startsBefore ? 'rounded-l-none' : 'rounded-l'} ${b.runsOn ? 'rounded-r-none' : 'rounded-r'} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-press`}
                            style={{ left: `${left}%`, width: `${w}%`, ...PRINT_EXACT }}
                          >
                            {/* The product named on a white chip, readable on every product colour. */}
                            {w > 6 && (
                              <span className="absolute inset-y-1 left-1 z-[2] flex max-w-[calc(100%-0.5rem)] items-center overflow-hidden rounded-[4px] bg-sheet/90 px-1.5 text-[11px] font-semibold leading-none text-press">
                                <span className="truncate">{b.product}</span>
                              </span>
                            )}
                          </button>
                        )
                      })}
                      {m.stops && m.stops >= span.from && m.stops <= span.to && (
                        <span
                          className="absolute -inset-y-0.5 z-[3] w-[3px] rounded-[2px] bg-press"
                          style={{ left: `${at(addDays(m.stops, 1))}%`, ...PRINT_EXACT }}
                          aria-hidden
                        />
                      )}
                      {tip && tip.key.startsWith(`${m.id}-`) && <Tooltip tip={tip} />}
                    </div>
                    {month && <RunsTo machine={m} month={month} />}
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

/** The day a machine runs to within the month, or that it carries on, or does not run. */
function RunsTo({ machine, month }: { machine: Machine; month: string }) {
  const { running, to, runsOn } = inMonth(machine, month)
  if (!running) return <span className="text-small text-press-2">Not running</span>
  return <span className="text-table font-semibold">{runsOn ? `Into ${monthOnly(shiftMonth(month, 1))}` : dayMonth(to!)}</span>
}

/** An idle or stopped stretch, named where there is room for the word. */
function Stretch({ left, width, label, dashed = false }: { left: number; width: number; label: string; dashed?: boolean }) {
  return (
    <span
      className={`absolute inset-y-1 z-[1] flex items-center justify-center overflow-hidden text-[11px] font-semibold text-press-2 ${dashed ? 'rounded border border-dashed border-press-2/50' : ''}`}
      style={{ left: `${left}%`, width: `${width}%` }}
      aria-hidden
    >
      {width > 6 && label}
    </span>
  )
}

const dates = (b: Bar) =>
  `${b.startsBefore ? (b.run.from ? `since ${dayMonth(b.run.from)}` : 'already running') : dayMonth(b.from)} to ${b.runsOn ? 'no end date' : dayMonth(b.to)}`

function ordersText(orders: Order[], backed: boolean): string {
  const parts = orders.map((o) =>
    o.kind === 'po' ? `PO ${o.po?.po ?? o.ref}${o.po ? `, ${o.po.state.label.toLowerCase()}` : ''}` : o.kind === 'required' ? (o.count === 1 ? 'PO required' : `${o.count} POs required`) : o.text,
  )
  return parts.length ? parts.join('; ') : backed ? 'alongside a forming machine' : 'no PO on the plan'
}

function Tooltip({ tip }: { tip: Tip }) {
  const { bar, left } = tip
  const pos = left > 55 ? { right: `${100 - left}%` } : { left: `${left}%` }
  const { orders, alongside, note } = bar.run
  return (
    <div role="tooltip" className="pointer-events-none absolute bottom-full z-10 mb-1.5 w-max max-w-[280px] rounded-[8px] bg-press px-2.5 py-1.5 text-small text-sheet shadow-lift" style={pos}>
      <p className="font-semibold">{bar.product}</p>
      <p>{dates(bar)}</p>
      {orders.map((o, i) => (
        <p key={i}>
          {o.kind === 'po'
            ? `PO ${o.po?.po ?? o.ref}${o.po ? `: ${o.po.state.label}` : ''}`
            : o.kind === 'required'
              ? o.count === 1 ? 'PO required' : `${o.count} POs required`
              : o.text}
        </p>
      ))}
      {!orders.length && <p>{alongside.length ? `Alongside ${alongside.map((m) => m.name).join(' and ')}` : 'No PO on the plan'}</p>}
      {note && <p>{note}</p>}
    </div>
  )
}
