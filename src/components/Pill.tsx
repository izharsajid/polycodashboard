import type { LucideIcon } from 'lucide-react'
import { AlertTriangle, Ban, CheckCircle2, Circle, Clock, PauseCircle, Plane } from 'lucide-react'

/**
 * A status pill. DESIGN-SYSTEM-SPEC section 5: 4px radius, 11px uppercase, a
 * semantic wash, and a small mark before the word.
 *
 * The mark is not decoration. It is what carries the state into a monochrome
 * board-pack printout, where four washes are one grey. Section 3: if removing
 * colour loses the meaning, add a mark.
 */
export type PillTone = 'neutral' | 'accent' | 'watch' | 'critical'

const TONE: Record<PillTone, string> = {
  neutral: 'bg-rule-soft text-ink-70',
  accent: 'bg-accent-soft text-accent',
  watch: 'bg-watch-soft text-watch',
  critical: 'bg-critical-soft text-critical',
}

/** The statuses `po_data` actually holds, plus the two it does not. */
const STATUS: Record<string, { tone: PillTone; icon: LucideIcon }> = {
  Dispatched: { tone: 'accent', icon: CheckCircle2 },
  Booked: { tone: 'neutral', icon: Clock },
  Processing: { tone: 'neutral', icon: Circle },
  Cancelled: { tone: 'neutral', icon: Ban },
  'On hold': { tone: 'watch', icon: PauseCircle },
  'PO pending': { tone: 'watch', icon: Clock },
}

const AIRFREIGHT = { tone: 'neutral' as PillTone, icon: Plane }

export function Pill({
  children,
  tone = 'neutral',
  icon: Icon,
}: {
  children: React.ReactNode
  tone?: PillTone
  icon?: LucideIcon
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-1 py-[3px] text-eyebrow font-semibold uppercase ${TONE[tone]}`}
    >
      {Icon && <Icon size={11} aria-hidden className="shrink-0" />}
      {children}
    </span>
  )
}

export function StatusPill({ status }: { status: string }) {
  if (!status) {
    return <span className="text-label text-ink-30">Not set</span>
  }

  // Two spellings of the same airfreight status, which is logged in
  // OPEN-QUESTIONS.md as something to fix in po_data rather than here.
  const known = STATUS[status] ?? (/expeditors/i.test(status) ? AIRFREIGHT : undefined)

  return (
    <Pill tone={known?.tone ?? 'watch'} icon={known?.icon ?? AlertTriangle}>
      {status}
    </Pill>
  )
}
