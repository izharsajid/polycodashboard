/**
 * Every figure and date on the page is formatted here and nowhere else.
 *
 * Money arrives in whole cents, because the statements carry cents and adding
 * floats would drift. Negatives are shown in parentheses, never with a minus
 * sign: a minus is easy to miss, and the one credit on the statements must read
 * as a credit.
 */

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

/* ---- Money ------------------------------------------------------------- */

function grouped(cents: number, dp: 0 | 2): string {
  const units = dp === 2 ? Math.abs(cents) / 100 : Math.round(Math.abs(cents) / 100)
  return units.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp })
}

/** A table cell, where the column header carries the currency: `194,699.10`, `(19,110.00)`. */
export function amount(cents: number): string {
  const text = grouped(cents, 2)
  return cents < 0 ? `(${text})` : text
}

/** Prose, to the cent: `US$2,841,167.50`, `(US$19,110.00)`. */
export function usd(cents: number): string {
  const text = `US$${grouped(cents, 2)}`
  return cents < 0 ? `(${text})` : text
}

/** Prose, whole dollars, half rounded away from zero: `US$218,551`. */
export function usdWhole(cents: number): string {
  const text = `US$${grouped(cents, 0)}`
  return cents < 0 ? `(${text})` : text
}

/** A chart axis in thousands of dollars: `250`, `(25)`. */
export function thousands(cents: number): string {
  const k = Math.round(Math.abs(cents) / 100_000)
  return cents < 0 ? `(${k})` : `${k}`
}

/** `34.2%`. Always shown beside the base it is a share of. */
export function percent(fraction: number): string {
  return `${(fraction * 100).toFixed(1)}%`
}

/* ---- Dates ------------------------------------------------------------- */

const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const MONTHS_SHORT = MONTHS_LONG.map((m) => m.slice(0, 3))

function parts(iso: string): [number, number, number] {
  const [y, m, d] = iso.split('-').map(Number)
  return [y, m, d ?? 1]
}

/** `June 2025`, from a date or a `YYYY-MM` id. */
export function monthLong(iso: string): string {
  const [y, m] = parts(iso)
  return `${MONTHS_LONG[m - 1]} ${y}`
}

/** `Jun`, for a chart axis where the year is given once. */
export function monthOnly(iso: string): string {
  return MONTHS_SHORT[parts(iso)[1] - 1]
}

/** `5 Feb 2026`. */
export function day(iso: string): string {
  const [y, m, d] = parts(iso)
  return `${d} ${MONTHS_SHORT[m - 1]} ${y}`
}

/** `5 Feb`. */
export function dayMonth(iso: string): string {
  const [, m, d] = parts(iso)
  return `${d} ${MONTHS_SHORT[m - 1]}`
}

/**
 * A date range written the short way a reader expects: `1 to 30 Jun 2025`,
 * `5 Feb to 5 Mar 2026`, `1 Dec 2025 to 4 Jan 2026`, and a single day as itself.
 */
export function range(startIso: string, endIso: string): string {
  if (startIso === endIso) return day(startIso)
  const [sy, sm, sd] = parts(startIso)
  const [ey, em] = parts(endIso)
  if (sy !== ey) return `${day(startIso)} to ${day(endIso)}`
  if (sm !== em) return `${dayMonth(startIso)} to ${day(endIso)}`
  return `${sd} to ${day(endIso)}`
}

/**
 * A range on the machine plan, where every date falls in the year the plan is
 * read in, so the year is left off: `5 to 19 Nov`, `10 Oct to 30 Dec`.
 */
export function dayRange(startIso: string, endIso: string): string {
  if (startIso === endIso) return dayMonth(startIso)
  const [, sm, sd] = parts(startIso)
  const [, em] = parts(endIso)
  return sm === em ? `${sd} to ${dayMonth(endIso)}` : `${dayMonth(startIso)} to ${dayMonth(endIso)}`
}

/** A stock quantity, `48.2` or `1,224`: up to `digits` decimals, none when whole. */
export function quantity(n: number, digits = 1): string {
  return new Intl.NumberFormat('en-GB', { maximumFractionDigits: digits }).format(n)
}
