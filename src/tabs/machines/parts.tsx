import { CalendarClock, CircleDashed, CircleStop, FileCheck, FileQuestion, Info, PackageOpen, PauseCircle, Play, Wrench, type LucideIcon } from 'lucide-react'
import { Fragment } from 'react'
import { FAMILY_BG } from '../../components/machines/MachineArt'
import StatePill from '../../components/StatePill'
import { addDays, type Bar, type Family, type MachineRef, type Now, type Order, type Run, type Span } from '../../engine/machines'
import { dayMonth, dayRange } from '../../lib/format'

/**
 * The pieces every part of the Machines page shares, so a machine's status, a
 * run's dates and a run's orders read the same in the summary, the chart and
 * the cards.
 */

/** A name short enough for a tile or the chart's label column. */
export const shortName = (name: string) => name.replace(/ Machine\b/, '')

export type Look = { label: string; tone: string; Icon: LucideIcon; quiet: boolean }

/** A machine's status today, in a word and an icon, never colour alone. */
export function look(now: Now): Look {
  switch (now.state) {
    case 'running':
      return { label: 'Running', tone: 'bg-income-wash text-income', Icon: Play, quiet: false }
    case 'maintenance':
      return { label: 'Maintenance', tone: 'bg-caution-wash text-caution', Icon: Wrench, quiet: false }
    case 'starts':
      return { label: `Starts ${dayMonth(now.bar.from)}`, tone: 'bg-sheet text-press-2', Icon: CalendarClock, quiet: true }
    case 'idle':
      return { label: `Idle, restarts ${dayMonth(now.bar.from)}`, tone: 'bg-sheet text-press-2', Icon: PauseCircle, quiet: true }
    case 'stopped':
      return { label: now.on ? `Stopped ${dayMonth(now.on)}` : 'Stopped', tone: 'bg-sheet text-press-2', Icon: CircleStop, quiet: true }
    case 'no-plan':
      return { label: 'No plan yet', tone: 'bg-sheet text-press-2', Icon: CircleDashed, quiet: true }
  }
}

export function StatusPill({ now }: { now: Now }) {
  const { label, tone, Icon } = look(now)
  return (
    <span className={`inline-flex w-max items-center gap-1 rounded-full px-2.5 py-1 text-small font-semibold ${tone}`}>
      <Icon size={13} strokeWidth={2.5} aria-hidden />
      {label}
    </span>
  )
}

export function Swatch({ family, className = '' }: { family: Family; className?: string }) {
  return (
    <span
      className={`inline-block h-2.5 w-2.5 shrink-0 rounded-[3px] ${FAMILY_BG[family]} ${className}`}
      style={{ printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}
      aria-hidden
    />
  )
}

/** One line under the summary tile: what happens next. */
export function nextStep(now: Now, stopNote: string | null): string {
  switch (now.state) {
    case 'running': {
      const { bar, next } = now
      if (next && next.from === addDays(bar.to, 1)) return `Then ${next.product}, from ${dayMonth(next.from)}`
      if (next) return `Until ${dayMonth(bar.to)}, then idle until ${dayMonth(next.from)}`
      return bar.runsOn ? 'No end date' : `Stops ${dayMonth(bar.to)}`
    }
    case 'starts':
    case 'idle':
      return now.bar.runsOn ? `From ${dayMonth(now.bar.from)}, no end date` : dayRange(now.bar.from, now.bar.to)
    case 'stopped':
      return stopNote ?? ''
    default:
      return ''
  }
}

/** A run's dates on a card, from a given day. A machine in maintenance is not running it yet. */
export function when(bar: Bar, today: string, maintenance = false): string {
  if (bar.from <= today && maintenance) return bar.runsOn ? 'No end date' : `Until ${dayMonth(bar.to)}`
  if (bar.from <= today) {
    const since = bar.run.from ? `Since ${dayMonth(bar.run.from)}` : 'Running'
    return bar.runsOn ? `${since}, no end date` : `${since}, until ${dayMonth(bar.to)}`
  }
  return bar.runsOn ? `From ${dayMonth(bar.from)}, no end date` : dayRange(bar.from, bar.to)
}

/** A span in the list of work without a PO. */
export function spanText(span: Span): string {
  if (span.from === null && span.to === null) return 'Running, no end date'
  if (span.from === null) return `Until ${dayMonth(span.to!)}`
  if (span.to === null) return `From ${dayMonth(span.from)}, no end date`
  return dayRange(span.from, span.to)
}

/** Machine names as links to their cards: `Machine 3 and Machine 4`. */
export function MachineLinks({ machines }: { machines: MachineRef[] }) {
  return (
    <>
      {machines.map((m, i) => (
        <Fragment key={m.id}>
          {i > 0 && (i === machines.length - 1 ? ' and ' : ', ')}
          <a href={`#m-${m.id}`} className="font-semibold text-press underline decoration-rule underline-offset-2 hover:decoration-press">
            {m.name}
          </a>
        </Fragment>
      ))}
    </>
  )
}

/** What the plan says a run is not backed by a PO for: still required, or made without one. */
export function NoPoChip({ text, kind }: { text: string; kind: 'required' | 'no-po' | 'none' }) {
  const Icon = kind === 'no-po' ? PackageOpen : FileQuestion
  return (
    <span className="inline-flex w-max max-w-full items-center gap-1 rounded-full bg-caution-wash px-2.5 py-1 text-small font-semibold text-caution">
      <Icon size={13} strokeWidth={2.5} aria-hidden className="shrink-0" />
      {text}
    </span>
  )
}

/** A PO in hand that efdashboard.com does not list yet: backed, so drawn solid, not as a gap. */
export function ReceivedChip({ text }: { text: string }) {
  return (
    <span className="inline-flex w-max max-w-full items-center gap-1 rounded-full bg-income-wash px-2.5 py-1 text-small font-semibold text-income">
      <FileCheck size={13} strokeWidth={2.5} aria-hidden className="shrink-0" />
      {text}
    </span>
  )
}

const requiredText = (count: number) => (count === 1 ? 'PO required' : `${count} POs required`)

/** A run's orders: each PO with its status on efdashboard.com, then anything without a PO. */
export function Orders({ run, live }: { run: Run; live: boolean }) {
  if (!run.orders.length && !run.alongside.length) {
    return (
      <p className="flex items-center gap-1.5 text-small text-press-2">
        <Info size={13} aria-hidden /> No PO on the plan
      </p>
    )
  }
  return (
    <ul className="space-y-1">
      {run.orders.map((o, i) => (
        <li key={i}>
          {o.kind === 'po' ? (
            <PoLine order={o} live={live} />
          ) : o.kind === 'received' ? (
            <ReceivedChip text={o.text} />
          ) : (
            <NoPoChip kind={o.kind} text={o.kind === 'required' ? requiredText(o.count) : o.text} />
          )}
        </li>
      ))}
      {run.alongside.length > 0 && (
        <li className="text-small text-press-2">
          Alongside <MachineLinks machines={run.alongside} />
        </li>
      )}
    </ul>
  )
}

function PoLine({ order: o, live }: { order: Extract<Order, { kind: 'po' }>; live: boolean }) {
  const po = o.po
  return (
    <div className="rounded bg-mist px-2 py-1.5 text-small">
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="font-semibold">PO {po?.po ?? o.ref}</span>
        {po && <StatePill state={po.state} />}
        {po?.isDispatched && po.dispatchDate && <span className="text-press-2">{dayMonth(po.dispatchDate)}</span>}
        {po && !po.isDispatched && po.readyDate && <span className="text-press-2">ready {dayMonth(po.readyDate)}</span>}
        {live && !po && <span className="text-press-2">Not on efdashboard.com</span>}
      </span>
      {po && po.po !== o.ref && <span className="block text-press-2">Written {o.ref} on the plan</span>}
      {o.note && <span className="block text-press-2">Marked “{o.note}” on the plan</span>}
      {o.quantities.map((q) => (
        <span key={q.label} className="block">
          {q.quantity} <span className="text-press-2">{q.label}</span>
        </span>
      ))}
    </div>
  )
}
