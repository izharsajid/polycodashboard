import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

/**
 * A small label on a card or panel. Tone carries meaning, never decoration, and
 * every badge has a word and usually an icon, so colour is never alone.
 */
const TONE = {
  neutral: 'border border-rule bg-sheet text-press-2',
  income: 'bg-income-wash text-income',
  caution: 'bg-caution-wash text-caution',
} as const

export default function Badge({
  tone = 'neutral',
  Icon,
  children,
}: {
  tone?: keyof typeof TONE
  Icon?: LucideIcon
  children: ReactNode
}) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-small font-semibold ${TONE[tone]}`}>
      {Icon && <Icon size={13} strokeWidth={2.5} aria-hidden />}
      {children}
    </span>
  )
}
