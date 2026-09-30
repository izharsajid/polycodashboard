import {
  BadgeCheck,
  Container,
  Factory,
  Handshake,
  Ship,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import type { Category } from '../../engine/classify'

/**
 * How each category looks, everywhere it appears: one hue, one icon. A reader
 * learns them once. Class names are written out in full so Tailwind finds them.
 */
export const CATEGORY_STYLE: Record<
  Category,
  { fill: string; stroke: string; bg: string; border: string; Icon: LucideIcon }
> = {
  payroll: { fill: 'fill-cat-payroll', stroke: 'stroke-cat-payroll', bg: 'bg-cat-payroll', border: 'border-cat-payroll', Icon: Users },
  raw: { fill: 'fill-cat-raw', stroke: 'stroke-cat-raw', bg: 'bg-cat-raw', border: 'border-cat-raw', Icon: Container },
  working: { fill: 'fill-cat-working', stroke: 'stroke-cat-working', bg: 'bg-cat-working', border: 'border-cat-working', Icon: Wallet },
  compliance: { fill: 'fill-cat-compliance', stroke: 'stroke-cat-compliance', bg: 'bg-cat-compliance', border: 'border-cat-compliance', Icon: BadgeCheck },
  supplier: { fill: 'fill-cat-supplier', stroke: 'stroke-cat-supplier', bg: 'bg-cat-supplier', border: 'border-cat-supplier', Icon: Handshake },
  facility: { fill: 'fill-cat-facility', stroke: 'stroke-cat-facility', bg: 'bg-cat-facility', border: 'border-cat-facility', Icon: Factory },
  logistics: { fill: 'fill-cat-logistics', stroke: 'stroke-cat-logistics', bg: 'bg-cat-logistics', border: 'border-cat-logistics', Icon: Ship },
}

/** Pattern id for a category's hatch: the "utilised" part of a statement carrying actuals. */
export const hatchId = (c: Category) => `hatch-${c}`
