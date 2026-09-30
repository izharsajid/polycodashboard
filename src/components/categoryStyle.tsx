import { BadgeCheck, Container, Factory, Handshake, Ship, Users, Wallet, type LucideIcon } from 'lucide-react'
import { CATEGORY_LABEL, type Category } from '../engine/classify'

/**
 * How each cost category looks everywhere: one hue and one icon, learned once.
 * Class names are written out in full so Tailwind finds them.
 */
export const CATEGORY_STYLE: Record<Category, { bg: string; Icon: LucideIcon }> = {
  payroll: { bg: 'bg-cat-payroll', Icon: Users },
  raw: { bg: 'bg-cat-raw', Icon: Container },
  working: { bg: 'bg-cat-working', Icon: Wallet },
  compliance: { bg: 'bg-cat-compliance', Icon: BadgeCheck },
  supplier: { bg: 'bg-cat-supplier', Icon: Handshake },
  facility: { bg: 'bg-cat-facility', Icon: Factory },
  logistics: { bg: 'bg-cat-logistics', Icon: Ship },
}

/** A category's icon on its colour: a small rounded tile with a white glyph. */
export function CategoryIcon({ category, size = 28 }: { category: Category; size?: number }) {
  const { bg, Icon } = CATEGORY_STYLE[category]
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded ${bg} text-sheet`}
      style={{ width: size, height: size, printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}
      title={CATEGORY_LABEL[category]}
      aria-hidden
    >
      <Icon size={Math.round(size * 0.58)} strokeWidth={2.25} />
    </span>
  )
}
