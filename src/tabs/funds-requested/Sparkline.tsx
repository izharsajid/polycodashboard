import type { Category } from '../../engine/classify'
import { CATEGORY_STYLE } from './categoryStyle'

/**
 * One category's amount on every request, oldest on the left. Each row has its
 * own scale, so it shows the shape of the movement, not its size: the size is
 * in the figures beside it.
 */
export default function Sparkline({
  category,
  values,
  mark,
}: {
  category: Category
  values: number[]
  /** Index of the selected statement, if it is a request. */
  mark: number | null
}) {
  const W = 132
  const H = 30
  const pad = 4
  const lo = Math.min(0, ...values)
  const hi = Math.max(...values, 1)
  const x = (i: number) => pad + (i / Math.max(1, values.length - 1)) * (W - pad * 2)
  const y = (v: number) => pad + ((hi - v) / (hi - lo)) * (H - pad * 2)
  const points = values.map((v, i) => `${x(i)},${y(v)}`).join(' ')

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden className="block">
      <line x1={pad} x2={W - pad} y1={y(0)} y2={y(0)} className="stroke-rule" />
      <polyline points={points} fill="none" className={CATEGORY_STYLE[category].stroke} strokeWidth={2} strokeLinejoin="round" />
      {mark !== null && <circle cx={x(mark)} cy={y(values[mark])} r={4} className="fill-marking stroke-press" strokeWidth={1.5} />}
    </svg>
  )
}
