import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import {
  AlertTriangle, Ban, CheckCircle2, Circle, Clock, PauseCircle, Plane,
} from 'lucide-react'

/**
 * Pills. DESIGN-SYSTEM-V2-SPEC sections 3 and 4.
 *
 * Three kinds, and they are not interchangeable:
 *
 * - a **status pill** says what state a row is in, in one of the six status
 *   colours, on its wash, rounded full, with a mark before the word;
 * - a **filter pill** is a control: leaf fill when active, white with a hairline
 *   when not, its count inside it in a lighter weight;
 * - a **summary pill** is grey and says how many rows are showing.
 *
 * Section 4 asks for a small dot before the word on a status pill, which doubles
 * as the greyscale mark. Section 5 keeps lucide icons in pills as "unchanged and
 * still required". A dot and an icon would be two marks for one job, so the icon
 * takes the dot's place: it sits where the dot would, does the same work in
 * greyscale, and says which state it is rather than only that there is one.
 */
export type PillTone = 'good' | 'info' | 'plan' | 'watch' | 'critical' | 'off'

const TONE: Record<PillTone, string> = {
  good: 'bg-good-wash text-good',
  info: 'bg-info-wash text-info',
  plan: 'bg-plan-wash text-plan',
  watch: 'bg-watch-wash text-watch',
  critical: 'bg-critical-wash text-critical',
  off: 'bg-off-wash text-off',
}

/** The statuses `po_data` actually holds, plus the two it does not. */
const STATUS: Record<string, { tone: PillTone; icon: LucideIcon }> = {
  Dispatched: { tone: 'good', icon: CheckCircle2 },
  Running: { tone: 'good', icon: CheckCircle2 },
  Booked: { tone: 'plan', icon: Clock },
  Processing: { tone: 'info', icon: Circle },
  Cancelled: { tone: 'off', icon: Ban },
  'On hold': { tone: 'critical', icon: PauseCircle },
  'PO pending': { tone: 'watch', icon: Clock },
}

const AIRFREIGHT = { tone: 'info' as PillTone, icon: Plane }

export function Pill({
  children,
  tone = 'off',
  icon: Icon,
}: {
  children: ReactNode
  tone?: PillTone
  icon?: LucideIcon
}) {
  return (
    <span className={`pill-status pill-print-plain ${TONE[tone]}`}>
      {Icon ? (
        <Icon size={11} aria-hidden className="shrink-0" />
      ) : (
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" aria-hidden />
      )}
      {children}
    </span>
  )
}

export function StatusPill({ status }: { status: string }) {
  if (!status) return <span className="sub">Not set</span>

  // Two spellings of the same airfreight status, which is logged in
  // OPEN-QUESTIONS.md as something to fix in po_data rather than here.
  const known = STATUS[status] ?? (/expeditors/i.test(status) ? AIRFREIGHT : undefined)

  return (
    <Pill tone={known?.tone ?? 'watch'} icon={known?.icon ?? AlertTriangle}>
      {status}
    </Pill>
  )
}

/**
 * A filter pill. Active is leaf fill with white text; inactive is white with a
 * rule border. The count sits inside in a lighter weight, so it reads as part of
 * the same control rather than a second figure.
 */
export function FilterPill({
  label,
  count,
  active,
  onClick,
}: {
  label: string
  count?: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`pill ${active ? 'pill-active' : ''} ${
        // A pill that would show nothing says so rather than quietly promising
        // rows that are not there.
        count === 0 && !active ? 'opacity-50' : ''
      }`}
    >
      {label}
      {count !== undefined && <span className="pill-count num">{count}</span>}
    </button>
  )
}

/** A row of filter pills, labelled above in kicker. Section 3. */
export function PillRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="no-print">
      <p className="kicker">{label}</p>
      <div className="mt-2 flex flex-wrap gap-2">{children}</div>
    </div>
  )
}

/** Grey summary pills, below the filter rows: "47 visible". */
export function SummaryPill({ children }: { children: ReactNode }) {
  return <span className="pill-summary">{children}</span>
}
