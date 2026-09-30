import { Ban, CheckCircle2, CircleDashed, Clock, PauseCircle, Ship, type LucideIcon } from 'lucide-react'
import type { StateKey } from '../engine/tracker'

/**
 * An order's status, as efdashboard.com names it. Tone carries meaning: green
 * for dispatched, blue for on its way, amber for held or waiting on a PO, grey
 * for cancelled, neutral while in production. Always an icon and the word.
 */
const LOOK: Record<StateKey, { tone: string; Icon: LucideIcon }> = {
  dispatched: { tone: 'bg-income-wash text-income', Icon: CheckCircle2 },
  confirmed: { tone: 'bg-info-wash text-info', Icon: Ship },
  requested: { tone: 'bg-info-wash text-info', Icon: Ship },
  booked: { tone: 'bg-info-wash text-info', Icon: Ship },
  ready: { tone: 'bg-info-wash text-info', Icon: Clock },
  awaiting: { tone: 'bg-mist text-press-2', Icon: Clock },
  processing: { tone: 'bg-mist text-press', Icon: CircleDashed },
  hold: { tone: 'bg-caution-wash text-caution', Icon: PauseCircle },
  'po-pending': { tone: 'bg-caution-wash text-caution', Icon: PauseCircle },
  required: { tone: 'bg-caution-wash text-caution', Icon: PauseCircle },
  cancelled: { tone: 'bg-mist text-press-2 line-through', Icon: Ban },
}

export default function StatePill({ state }: { state: { key: StateKey; label: string } }) {
  const { tone, Icon } = LOOK[state.key]
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-small font-semibold ${tone}`}>
      <Icon size={13} strokeWidth={2.5} aria-hidden />
      {state.label}
    </span>
  )
}
