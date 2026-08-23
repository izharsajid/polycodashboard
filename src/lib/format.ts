/**
 * Timestamps are stored as UTC and shown in whatever timezone the reader is in,
 * named, because this dashboard is read in Bahrain and in the UK and a bare time
 * with no zone is two different times.
 */
export function whenLocal(iso: string | null): string {
  if (!iso) return 'Not yet'
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return 'Not known'

  return at.toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  })
}

/**
 * Money. REDESIGN-2-SPEC section 3: one formatter, and nothing formats money
 * inline. A financial dashboard that shows `5,771,015` and expects the reader to
 * supply the currency is wrong on every screen.
 *
 * Negatives in parentheses, never a minus sign, because that is what a finance
 * reader expects and a minus is easy to miss. Zero is `$0.00`, never a dash or a
 * blank: a dash reads as "not applicable" when the answer is "nothing".
 */
export function money(value: number, dp: 0 | 2 = 2): string {
  const size = Math.abs(value).toLocaleString('en-US', {
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  })
  return value < 0 ? `($${size})` : `$${size}`
}

/** Whole dollars, for headline figures. */
export const moneyWhole = (value: number) => money(value, 0)

/**
 * `$5.77m`. Tiles only, where space is tight. Never in a table, never in the
 * statement, never in an export.
 */
export function moneyShort(value: number): string {
  const size = Math.abs(value)
  const text =
    size >= 1_000_000
      ? `$${(size / 1_000_000).toFixed(2)}m`
      : size >= 1_000
        ? `$${(size / 1_000).toFixed(0)}k`
        : `$${size.toFixed(0)}`
  return value < 0 ? `(${text})` : text
}

/** `28 July 2026` in prose. Section 7 of the design system: never numeric. */
const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const MONTHS_SHORT = MONTHS_LONG.map((m) => m.slice(0, 3))

export function dateProse(iso: string | null): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${Number(d)} ${MONTHS_LONG[Number(m) - 1]} ${y}`
}

/** `28 Jul 2026` in tables. */
export function dateTable(iso: string | null): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${Number(d)} ${MONTHS_SHORT[Number(m) - 1]} ${y}`
}

/** `Jul 2026`. */
export function monthTable(period: string): string {
  const [y, m] = period.split('-')
  return `${MONTHS_SHORT[Number(m) - 1]} ${y}`
}

/** `July 2026`. */
export function monthProse(period: string): string {
  const [y, m] = period.split('-')
  return `${MONTHS_LONG[Number(m) - 1]} ${y}`
}
