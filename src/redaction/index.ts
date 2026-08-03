/**
 * Partner mode is a whitelist. A field is hidden unless explicitly permitted.
 * A blacklist leaks the first time somebody adds a field.
 */
export type Mode = 'internal' | 'partner'

export const MODE: Mode =
  (import.meta.env.VITE_MODE as Mode) === 'partner' ? 'partner' : 'internal'

export const isPartner = MODE === 'partner'

/** Things a partner build may show. Everything else is internal only. */
export const PARTNER_VISIBLE = new Set([
  'polyco-position',
  'funding-statements',
  'order-book',
  'capacity',
  'configurations',
  'roadmap',
  'assumptions',
])

export function visible(section: string) {
  return MODE === 'internal' || PARTNER_VISIBLE.has(section)
}
