import { ArrowDownLeft, CircleHelp, Truck } from 'lucide-react'
import Badge from '../../components/Badge'
import type { Month } from '../../engine/ledger'
import { amount, monthLong, usd } from '../../lib/format'

/**
 * One month of the ledger: the balance at month end, and what came in (green)
 * and went out. A month with no movements is a quiet tile, not a button.
 */
export default function LedgerMonthCard({ m, onOpen }: { m: Month; onOpen: () => void }) {
  if (m.movements.length === 0) {
    return (
      <div className="flex h-full flex-col rounded-card border border-dashed border-rule p-4 text-press-2">
        <h3 className="condensed text-title font-bold">{monthLong(m.month)}</h3>
        <p className="mt-1 text-small">No movements</p>
        <p className="mt-auto pt-3 text-small">Balance {amount(m.balanceCents)}</p>
      </div>
    )
  }

  const unattributed = m.movements.filter((x) => x.unattributed).length

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-haspopup="dialog"
      className="flex h-full w-full flex-col rounded-card border border-rule bg-sheet p-4 text-left shadow-card transition-shadow hover:shadow-lift"
    >
      <h3 className="condensed text-title font-bold">{monthLong(m.month)}</h3>
      <p className="mt-3 text-small text-press-2">Balance at month end</p>
      <p className="num text-figure font-bold">{usd(m.balanceCents)}</p>

      <dl className="mt-3 space-y-1 text-table">
        {m.receivedCents > 0 && (
          <div className="flex items-center justify-between gap-2 text-income">
            <dt className="flex items-center gap-1.5 font-semibold">
              <ArrowDownLeft size={15} aria-hidden /> Received
            </dt>
            <dd className="num font-semibold">{amount(m.receivedCents)}</dd>
          </div>
        )}
        {m.deliveredCents > 0 && (
          <div className="flex items-center justify-between gap-2">
            <dt className="flex items-center gap-1.5">
              <Truck size={15} aria-hidden /> Delivered
            </dt>
            <dd className="num">{amount(-m.deliveredCents)}</dd>
          </div>
        )}
      </dl>

      {unattributed > 0 && (
        <div className="mt-3">
          <Badge tone="caution" Icon={CircleHelp}>
            {unattributed} unattributed {unattributed === 1 ? 'receipt' : 'receipts'}
          </Badge>
        </div>
      )}
    </button>
  )
}
