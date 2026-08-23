/**
 * Chart conventions, in one place, so every plot on the dashboard agrees.
 *
 * DESIGN-SYSTEM-SPEC section 6: two colours maximum, no vertical gridlines,
 * three or four horizontal ones, axis text in ink-50 at 11px, money axes as
 * `$0` `$1m` `$2m`, direct labels rather than a legend, no animation, readable
 * in greyscale.
 */
export const CHART = {
  /** The series carrying the message. */
  accent: '#2D5F3F',
  /** Context series. Never a second accent. */
  context: '#A8ADB3',
  grid: '#E4E6E8',
  axis: '#6F757C',
  /** A shortfall, an exception or a placeholder. Never decoration. */
  critical: '#9B2C24',
  surface: '#FFFFFF',
} as const

export const AXIS_TICK = { fill: CHART.axis, fontSize: 11 } as const

/** Four horizontal gridlines is as many as a reader needs. */
export const GRID_COUNT = 4

/**
 * `$0`, `$1m`, `$2m` on a money axis. Whole millions once past one, thousands
 * below it, so an axis never carries more precision than it can show.
 */
export function axisMoney(value: number): string {
  const sign = value < 0 ? '-' : ''
  const size = Math.abs(value)
  if (size >= 1_000_000) return `${sign}$${(size / 1_000_000).toFixed(size % 1_000_000 === 0 ? 0 : 1)}m`
  if (size >= 1_000) return `${sign}$${Math.round(size / 1_000)}k`
  return `${sign}$${Math.round(size)}`
}

/** Nothing animates on load. Section 6, and section 7's reduced-motion rule. */
export const NO_ANIMATION = { isAnimationActive: false } as const

export const TOOLTIP_STYLE = {
  border: `1px solid ${CHART.grid}`,
  borderRadius: 4,
  fontSize: 13,
  fontVariantNumeric: 'tabular-nums',
  background: CHART.surface,
} as const
