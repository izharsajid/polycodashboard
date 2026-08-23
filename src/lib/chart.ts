/**
 * Chart conventions, in one place, so every plot on the dashboard agrees.
 *
 * DESIGN-SYSTEM-V2-SPEC section 5: leaf for the series carrying the message,
 * ink-muted at low opacity for context. Status colours appear in a chart only
 * where they mean there exactly what they mean in a pill, which in practice is
 * `critical` on a shortfall and nowhere else.
 *
 * Carried over from REDESIGN-2 and still required: no vertical gridlines, three
 * or four horizontal ones, money axes as `$0` `$1m` `$2m`, direct labels rather
 * than a legend, no animation, readable in greyscale.
 */
export const CHART = {
  /** The series carrying the message. */
  accent: '#507A48',
  /** Context series. Never a second accent. */
  context: '#6D7869',
  grid: '#DFE5DC',
  axis: '#687365',
  /** A shortfall or a placeholder. The only red in the system. */
  critical: '#AD3029',
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

/** Nothing animates on load. Section 7's reduced-motion rule. */
export const NO_ANIMATION = { isAnimationActive: false } as const

export const TOOLTIP_STYLE = {
  border: `1px solid ${CHART.grid}`,
  borderRadius: 6,
  fontSize: 13,
  fontVariantNumeric: 'tabular-nums',
  background: CHART.surface,
  boxShadow: '0 10px 30px rgba(59, 89, 54, 0.08)',
} as const
