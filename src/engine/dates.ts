/**
 * Calendar days as whole numbers, so coverage can be counted day by day without
 * timezones getting involved. Day 0 is 1 January 1970, UTC.
 */
const MS_PER_DAY = 86_400_000

export function toDay(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return Date.UTC(y, m - 1, d) / MS_PER_DAY
}

export function fromDay(day: number): string {
  return new Date(day * MS_PER_DAY).toISOString().slice(0, 10)
}

/** Inclusive count: 1 to 30 June is 30 days. */
export function daysInclusive(startIso: string, endIso: string): number {
  return toDay(endIso) - toDay(startIso) + 1
}

/** Whether a period is exactly the calendar month its statement id names. */
export function coversCalendarMonth(id: string, startIso: string, endIso: string): boolean {
  const [y, m] = id.split('-').map(Number)
  const first = fromDay(Date.UTC(y, m - 1, 1) / MS_PER_DAY)
  const last = fromDay(Date.UTC(y, m, 0) / MS_PER_DAY)
  return startIso === first && endIso === last
}
