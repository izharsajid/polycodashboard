import { monthOnly, thousands } from '../lib/format'
import { useChartWidth } from './useChartWidth'

/**
 * One bar per month, the chart every tab shares. Solid bars in ink; an outlined
 * bar for anything shown but not counted; an optional dashed reference line in
 * the marking yellow. Handles values below zero.
 *
 * Not interactive: each tab's month-by-month table carries every figure, and
 * each bar's exact amount is in its tooltip.
 */
export type Bar = {
  /** `YYYY-MM`. */
  id: string
  cents: number
  /** Shown, but not counted: drawn as a dashed outline. */
  outline?: boolean
  /** A word under the month, such as "actuals". */
  note?: string
  /** The tooltip. */
  title: string
}

const STEPS = [2_500_000, 5_000_000, 10_000_000, 25_000_000, 50_000_000]

export default function MonthBars({
  bars,
  reference,
  label,
}: {
  bars: Bar[]
  reference?: { cents: number; label: string }
  /** What the chart shows, for screen readers. */
  label: string
}) {
  const { ref, width, printing } = useChartWidth<HTMLDivElement>()
  const n = bars.length

  const narrow = width < 640
  const H = printing ? 240 : narrow ? 220 : 280
  const M = { top: 24, right: narrow || !reference ? 8 : 84, bottom: 34, left: 44 }
  const plotW = Math.max(0, width - M.left - M.right)
  const plotH = H - M.top - M.bottom

  const max = Math.max(...bars.map((b) => b.cents), reference?.cents ?? 0, 1)
  const min = Math.min(...bars.map((b) => b.cents), 0)
  const step = STEPS.find((st) => Math.ceil(max / st) - Math.floor(min / st) <= 6) ?? STEPS[STEPS.length - 1]
  const top = Math.ceil(max / step) * step
  const bottom = Math.floor(min / step) * step
  const y = (cents: number) => M.top + ((top - cents) / (top - bottom)) * plotH
  const ticks: number[] = []
  for (let v = bottom; v <= top; v += step) ticks.push(v)

  const slot = plotW / n
  const barW = Math.max(3, Math.min(44, slot * 0.6))
  const compact = slot < 44
  const sparse = slot < 16

  return (
    <div ref={ref} className="w-full">
      {width > 0 ? (
        <svg width="100%" height={H} viewBox={`0 0 ${width} ${H}`} className="block overflow-visible" role="img" aria-label={label}>
          <text x={0} y={10} className="fill-press-2 text-small">US$ thousands</text>
          {ticks.map((v) => (
            <g key={v}>
              <line x1={M.left} x2={M.left + plotW} y1={y(v)} y2={y(v)} className={v === 0 ? 'stroke-press' : 'stroke-rule'} />
              <text x={M.left - 6} y={y(v) + 4} textAnchor="end" className="fill-press-2 text-small num">
                {thousands(v)}
              </text>
            </g>
          ))}

          {/* The reference line sits under the bars. On a phone its label goes top
              right; otherwise in the margin beside the line. */}
          {reference && (
            <>
              <line x1={M.left} x2={M.left + plotW} y1={y(reference.cents)} y2={y(reference.cents)} className="stroke-marking" strokeWidth={2.5} strokeDasharray="6 4" />
              <text
                x={narrow ? M.left + plotW : M.left + plotW + 8}
                y={narrow ? 10 : y(reference.cents) + 4}
                textAnchor={narrow ? 'end' : 'start'}
                className="fill-press text-small font-semibold"
              >
                {reference.label}
              </text>
            </>
          )}

          {bars.map((b, i) => {
            const cx = M.left + i * slot + slot / 2
            const x = cx - barW / 2
            const y1 = Math.min(y(b.cents), y(0))
            const h = Math.abs(y(0) - y(b.cents))
            const firstOfYear = i === 0 || b.id.endsWith('-01')
            const year = b.id.slice(0, 4)
            return (
              <g key={b.id}>
                <title>{b.title}</title>
                {b.outline ? (
                  <rect x={x + 1} y={y1} width={Math.max(1, barW - 2)} height={h} className="fill-none stroke-press-2" strokeWidth={1.5} strokeDasharray="4 3" />
                ) : (
                  <rect x={x} y={y1} width={barW} height={h} className="fill-press" />
                )}
                {!compact && (
                  <text
                    x={cx}
                    y={b.cents >= 0 ? y(b.cents) - 6 : y(b.cents) + 13}
                    textAnchor="middle"
                    className="fill-press-2 stroke-sheet text-small num"
                    strokeWidth={3}
                    paintOrder="stroke"
                  >
                    {thousands(b.cents)}
                  </text>
                )}
                {!sparse && (
                  <text x={cx} y={H - M.bottom + 15} textAnchor="middle" className="fill-press text-small">
                    {compact ? monthOnly(b.id).charAt(0) : monthOnly(b.id)}
                  </text>
                )}
                {(firstOfYear || (b.note && !sparse)) && (
                  <text x={cx} y={H - M.bottom + (sparse ? 15 : 28)} textAnchor={sparse ? 'start' : 'middle'} className="fill-press-2 text-small">
                    {b.note && !sparse ? (compact ? b.note.slice(0, 3) + '.' : b.note) : compact ? `’${year.slice(2)}` : year}
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
