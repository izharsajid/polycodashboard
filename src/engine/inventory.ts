/**
 * The stock of materials, read live from efdashboard.com. No React.
 *
 * efdashboard.com's own rules, ported: days left is stock divided by average
 * daily use, and none when there is no daily use. An item is below its minimum
 * when stock is under min_stock. Free-text notes are not carried: the
 * dashboard is shared with Polyco, and supplier names never appear on it.
 */
import { z } from 'zod'

const Num = z.union([z.number(), z.string()]).nullable().optional().transform((v) => (v === null || v === undefined || v === '' ? null : Number(v)))
const Text = z.string().nullable().optional().transform((v) => (v ?? '').trim())

export const InventoryRow = z.object({
  id: z.number(),
  section: z.string(),
  item: Text,
  stock: Num,
  unit: Text,
  min_stock: Num,
  ordered: Num,
  eta: Text,
  daily_usage: Num,
  sort_order: z.number().nullable().optional(),
})

export const InventoryPayload = z.object({
  rows: z.array(InventoryRow),
  as_of: z.string().nullable(),
  fetched_at: z.string(),
})
export type InventoryPayloadT = z.infer<typeof InventoryPayload>

export type Item = {
  id: number
  section: string
  item: string
  stock: number
  unit: string
  min: number
  dailyUse: number | null
  /** Days of stock left at the average daily use; null with no daily use. */
  daysLeft: number | null
  belowMin: boolean
  ordered: number
  /** As efdashboard.com writes it: a date, or a number of days. */
  eta: string
}

export type Inventory = {
  asOf: string | null
  items: Item[]
  sections: { key: string; title: string; items: Item[] }[]
  /** The material with the fewest days left. */
  shortest: Item | null
}

const SECTIONS: { key: string; title: string }[] = [
  { key: 'fiber', title: 'Fiber' },
  { key: 'lamination', title: 'Lamination Film' },
  { key: 'others', title: 'Others' },
]

export function buildInventory(payload: InventoryPayloadT): Inventory {
  const items: Item[] = payload.rows.map((r) => {
    const stock = r.stock ?? 0
    const daily = r.daily_usage && r.daily_usage > 0 ? r.daily_usage : null
    return {
      id: r.id,
      section: r.section,
      item: r.item,
      stock,
      unit: r.unit,
      min: r.min_stock ?? 0,
      dailyUse: daily,
      daysLeft: daily ? stock / daily : null,
      belowMin: r.min_stock !== null && stock < r.min_stock,
      ordered: r.ordered ?? 0,
      eta: r.eta && r.eta !== '0' ? r.eta : '',
    }
  })
  const sections = SECTIONS.map((s) => ({ ...s, items: items.filter((i) => i.section === s.key) })).filter((s) => s.items.length)
  const withDays = items.filter((i) => i.daysLeft !== null).sort((a, b) => a.daysLeft! - b.daysLeft!)
  // Items in a section efdashboard.com adds later still show, under their own name.
  const known = new Set(SECTIONS.map((s) => s.key))
  const extra = [...new Set(items.filter((i) => !known.has(i.section)).map((i) => i.section))].map((k) => ({
    key: k,
    title: k.charAt(0).toUpperCase() + k.slice(1),
    items: items.filter((i) => i.section === k),
  }))
  return { asOf: payload.as_of, items: [...sections, ...extra].flatMap((s) => s.items), sections: [...sections, ...extra], shortest: withDays[0] ?? null }
}
