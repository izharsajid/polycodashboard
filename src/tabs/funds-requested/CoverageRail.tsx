import { useState, type ReactNode } from 'react'
import { toDay } from '../../engine/dates'
import { kindLabel, statementName, type Model } from '../../engine/funds'
import { day, monthOnly, range } from '../../lib/format'
import { useChartWidth } from './useChartWidth'

/**
 * The statement record on a true calendar, from the first statement to the as-at
 * date. Where the chart above gives every statement the same width, this shows
 * what each one actually covers: the days no request covers, the five days two
 * statements both claim, and the month only an actuals statement speaks for.
 *
 * Mouse only. Every mark here has a keyboard route elsewhere: the chart's
 * columns select a statement, and the register below lists every gap and
 * overlap with a button of its own.
 */
type Props = { model: Model; selectedId: string; onSelect: (id: string) => void }

type Tip = { x: number; body: ReactNode }

export default function CoverageRail({ model, selectedId, onSelect }: Props) {
  const { ref, width } = useChartWidth<HTMLDivElement>()
  const [tip, setTip] = useState<Tip | null>(null)

  const narrow = width < 640
  const left = 40
  const right = 8
  const H = 58
  const bandY = 6
  const bandH = 20

  const start = toDay(model.recordStart)
  const end = Math.max(toDay(model.asAt), toDay(model.recordEnd)) + 1
  const plotW = Math.max(0, width - left - right)
  const x = (d: number) => left + ((d - start) / (end - start)) * plotW
  const span = (a: string, b: string) => ({ x: x(toDay(a)), w: x(toDay(b) + 1) - x(toDay(a)) })

  // Month ticks, with a label every third month (every sixth on a phone).
  const months: { d: number; iso: string }[] = []
  {
    const first = new Date(model.recordStart)
    for (let m = 0; ; m++) {
      const at = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + m, 1))
      const d = at.getTime() / 86_400_000
      if (d > end) break
      months.push({ d, iso: at.toISOString().slice(0, 10) })
    }
  }
  const every = narrow ? 6 : 3

  const show = (px: number, body: ReactNode) => setTip({ x: px, body })

  return (
    <div ref={ref} className="relative w-full" onMouseLeave={() => setTip(null)}>
      {width > 0 ? (
        <svg width="100%" height={H} viewBox={`0 0 ${width} ${H}`} className="block" aria-hidden>
          <defs>
            <pattern id="rail-gap" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="5" height="5" className="fill-sheet" />
              <rect width="1.5" height="5" className="fill-press-2" />
            </pattern>
            <pattern id="rail-overlap" width="5" height="5" patternUnits="userSpaceOnUse">
              <rect width="5" height="5" className="fill-press" />
              <path d="M0 0L5 5M5 0L0 5" className="stroke-sheet" strokeWidth={1.2} />
            </pattern>
          </defs>

          {/* Requests, each a block across its real period. */}
          {model.requests.map((s) => {
            const r = span(s.periodStart, s.periodEnd)
            const selected = s.id === selectedId
            return (
              <rect
                key={s.id}
                x={r.x + 0.5}
                y={bandY}
                width={Math.max(1, r.w - 1)}
                height={bandH}
                className={`cursor-pointer ${selected ? 'fill-marking stroke-press' : 'fill-press-2'}`}
                strokeWidth={selected ? 2 : 0}
                onClick={() => onSelect(s.id)}
                onMouseMove={() =>
                  show(r.x + r.w / 2, (
                    <>
                      <p className="font-semibold">{statementName(s)}</p>
                      <p className="text-press-2">{kindLabel(s.kind)}, {range(s.periodStart, s.periodEnd)}, {s.days} days</p>
                    </>
                  ))
                }
              />
            )
          })}

          {/* Days no request covers. */}
          {model.gaps.map((g) => {
            const r = span(g.start, g.end)
            return (
              <rect
                key={g.start}
                x={r.x}
                y={bandY}
                width={Math.max(2, r.w)}
                height={bandH}
                fill="url(#rail-gap)"
                className="cursor-pointer stroke-press-2"
                strokeWidth={0.75}
                onClick={() => onSelect(g.statementId)}
                onMouseMove={() =>
                  show(r.x + r.w / 2, (
                    <>
                      <p className="font-semibold">No request: {range(g.start, g.end)}, {g.days} days</p>
                      <p className="text-press-2">{g.reason}</p>
                    </>
                  ))
                }
              />
            )
          })}

          {/* Days two statements both claim. */}
          {model.overlaps.map((o) => {
            const r = span(o.start, o.end)
            return (
              <rect
                key={o.start}
                x={r.x}
                y={bandY - 3}
                width={Math.max(2, r.w)}
                height={bandH + 6}
                fill="url(#rail-overlap)"
                onMouseMove={() =>
                  show(r.x + r.w / 2, (
                    <>
                      <p className="font-semibold">Claimed twice: {range(o.start, o.end)}, {o.days} days</p>
                      <p className="text-press-2">
                        Both the {o.statementIds.map((id) => monthOnly(id)).join(' and ')} statements cover these days.
                      </p>
                    </>
                  ))
                }
              />
            )
          })}

          {/* Statements that record actuals: an outline over the gap they sit in. */}
          {model.excluded.map((s) => {
            const r = span(s.periodStart, s.periodEnd)
            return (
              <rect
                key={s.id}
                x={r.x + 1}
                y={bandY + 1}
                width={Math.max(1, r.w - 2)}
                height={bandH - 2}
                className="fill-none stroke-press"
                strokeWidth={s.id === selectedId ? 2.5 : 1.5}
                strokeDasharray="4 3"
                pointerEvents="none"
              />
            )
          })}

          {/* Record end and as-at markers. */}
          <line x1={x(toDay(model.recordEnd) + 1)} x2={x(toDay(model.recordEnd) + 1)} y1={bandY - 4} y2={bandY + bandH + 4} className="stroke-press" strokeWidth={1.5} />
          <line x1={x(end)} x2={x(end)} y1={bandY - 4} y2={bandY + bandH + 4} className="stroke-press" strokeWidth={2} />

          {/* Month axis. */}
          {months.map((m, i) => (
            <g key={m.iso}>
              <line x1={x(m.d)} x2={x(m.d)} y1={bandY + bandH} y2={bandY + bandH + (i % every === 0 ? 6 : 3)} className="stroke-press-2" />
              {i % every === 0 && (
                <text x={x(m.d)} y={H - 6} textAnchor="start" className="fill-press-2 text-small">
                  {monthOnly(m.iso)} {m.iso.slice(2, 4)}
                </text>
              )}
            </g>
          ))}
        </svg>
      ) : (
        <div style={{ height: H }} />
      )}

      {tip && (
        <div
          className="pointer-events-none absolute z-10 w-max max-w-[300px] border border-press bg-sheet px-3 py-2 text-small text-press"
          style={{ left: Math.min(Math.max(0, tip.x - 20), Math.max(0, width - 300)), top: 0, transform: 'translateY(-100%)' }}
          aria-hidden
        >
          {tip.body}
        </div>
      )}

      <p className="mt-1 text-small text-press-2">
        Record ends {day(model.recordEnd)}. As at {day(model.asAt)}.
      </p>
    </div>
  )
}
