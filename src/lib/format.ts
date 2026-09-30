/**
 * Every figure and date on the page is formatted here and nowhere else.
 *
 * Money arrives in whole cents, because the statements carry cents and adding
 * floats would drift. Negatives are shown in parentheses, never with a minus
 * sign: a minus is easy to miss, and the one credit on the statements must read
 * as a credit.
 */

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
