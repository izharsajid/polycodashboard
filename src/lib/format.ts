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
