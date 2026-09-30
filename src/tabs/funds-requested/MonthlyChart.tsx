import { monthOnly, range, thousands, usd } from '../../lib/format'
import type { Model } from '../../engine/funds'
import { useChartWidth } from './useChartWidth'

/**
 * What was asked for each month, one bar per statement, with the average across
 * the requests as a dashed line. A statement of actuals is drawn as an outline:
 * it is not a request and is not in the average.
 *
 * Not interactive: the month-by-month table below carries every figure, and
 * each bar's exact amount is in its tooltip.
 */
const STEPS = [2_500_000, 5_000_000, 10_000_000]

export default function MonthlyChart({ model }: { model: Model }) {
  const { ref, width, printing } = useChartWidth<HTMLDivElement>()
  const statements = model.statements
  const n = statements.length

  const narrow = width < 640
  const H = printing ? 240 : narrow ? 220 : 280
  const M = { top: 24, right: narrow ? 8 : 84, bottom: 34, left: 40 }
  const plotW = Math.max(0, width - M.left - M.right)
  const plotH = H - M.top - M.bottom

  const max = Math.max(...statements.map((s) => s.statedCents), 1)
  const step = STEPS.find((st) => Math.ceil(max / st) <= 6) ?? STEPS[STEPS.length - 1]
  const top = Math.ceil(max / step) * step
  const y = (cents: number) => M.top + (1 - cents / top) * plotH
  const ticks = Array.from({ length: top / step + 1 }, (_, i) => i * step)

  const slot = plotW / n
  const barW = Math.max(8, Math.min(44, slot * 0.6))
  const compact = slot < 44

  return (
    <div ref={ref} className="w-full">
      {width > 0 ? (
        <svg
          width="100%"
          height={H}
          viewBox={`0 0 ${width} ${H}`}
          className="block overflow-visible"
          role="img"
          aria-label={`Funds requested each month. ${model.headline}`}
        >
          <text x={0} y={10} className="fill-press-2 text-small">US$ thousands</text>
          {ticks.map((v) => (
            <g key={v}>
              <line x1={M.left} x2={M.left + plotW} y1={y(v)} y2={y(v)} className={v === 0 ? 'stroke-press' : 'stroke-rule'} />
              <text x={M.left - 6} y={y(v) + 4} textAnchor="end" className="fill-press-2 text-small num">
                {thousands(v)}
              </text>
            </g>
          ))}

          {/* The average across the requests, under the bars. On a phone its label
              sits top right; otherwise in the margin beside the line. */}
          <line
            x1={M.left}
            x2={M.left + plotW}
            y1={y(model.averageCents)}
            y2={y(model.averageCents)}
            className="stroke-marking"
            strokeWidth={2.5}
            strokeDasharray="6 4"
          />
          <text
            x={narrow ? M.left + plotW : M.left + plotW + 8}
            y={narrow ? 10 : y(model.averageCents) + 4}
            textAnchor={narrow ? 'end' : 'start'}
            className="fill-press text-small font-semibold"
          >
            Average {thousands(model.averageCents)}
          </text>

          {statements.map((s, i) => {
            const cx = M.left + i * slot + slot / 2
            const x = cx - barW / 2
            const firstOfYear = i === 0 || s.id.endsWith('-01')
            const tip = `${range(s.periodStart, s.periodEnd)}: ${usd(s.statedCents)}${s.isRequest ? ' requested' : ', actual spending, not a request'}`
            return (
              <g key={s.id}>
                <title>{tip}</title>
                {s.isRequest ? (
                  <rect x={x} y={y(s.statedCents)} width={barW} height={y(0) - y(s.statedCents)} className="fill-press" />
                ) : (
                  <rect
                    x={x + 1}
                    y={y(s.statedCents)}
                    width={barW - 2}
                    height={y(0) - y(s.statedCents)}
                    className="fill-none stroke-press-2"
                    strokeWidth={1.5}
                    strokeDasharray="4 3"
                  />
                )}
                {!compact && (
                  <text x={cx} y={y(s.statedCents) - 6} textAnchor="middle" className="fill-press-2 stroke-sheet text-small num" strokeWidth={3} paintOrder="stroke">
                    {thousands(s.statedCents)}
                  </text>
                )}
                <text x={cx} y={H - M.bottom + 15} textAnchor="middle" className="fill-press text-small">
                  {compact ? monthOnly(s.id).charAt(0) : monthOnly(s.id)}
                </text>
                {(firstOfYear || !s.isRequest) && (
                  <text x={cx} y={H - M.bottom + 28} textAnchor="middle" className="fill-press-2 text-small">
                    {!s.isRequest ? (compact ? 'act.' : 'actuals') : compact ? `’${s.id.slice(2, 4)}` : s.id.slice(0, 4)}
                  </text>
                )}
              </g>
            )
          })}

        </svg>
      ) : (
        <div style={{ height: H }} />
      )}
    </div>
  )
}
