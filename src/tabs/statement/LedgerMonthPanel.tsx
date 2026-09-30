import { CircleHelp } from 'lucide-react'
import Badge from '../../components/Badge'
import Panel from '../../components/Panel'
import Tile from '../../components/Tile'
import type { Month } from '../../engine/ledger'
import { amount, day, monthLong } from '../../lib/format'
import { describe } from './describe'
import { movementIcon } from './movementStyle'

/** A ledger month opened up: every movement in date order, money in in green. */
export default function LedgerMonthPanel({
  m,
  opening,
  onClose,
}: {
  m: Month | null
  /** The balance carried in from the month before. */
  opening: number
  onClose: () => void
}) {
  return (
    <Panel open={m !== null} onClose={onClose} title={m ? monthLong(m.month) : ''} eyebrow="PHL/EcoFibre statement">
      {m && (
        <div className="space-y-5 text-table">
          <div className="grid gap-2 sm:grid-cols-4">
            <Tile label="Brought forward" value={amount(opening)} />
            <Tile label="Received" value={amount(m.receivedCents)} tone="income" />
            <Tile label="Delivered" value={amount(-m.deliveredCents)} />
            <Tile label="Balance at month end" value={amount(m.balanceCents)} tone="strong" />
          </div>

          <ul className="divide-y divide-rule rounded-card bg-mist px-3">
            {m.movements.map((x) => {
              const Icon = movementIcon(x)
              const incoming = x.kind === 'receipt'
              return (
                <li key={x.key} className="flex items-start gap-3 py-2.5">
                  <span
                    className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded ${
                      incoming ? 'bg-income-wash text-income' : 'bg-sheet text-press'
                    }`}
                    aria-hidden
                  >
                    <Icon size={16} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block">{describe(x)}</span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-small text-press-2">
                      {x.date && day(x.date)}
                      <span>Workbook row {x.sourceRow}</span>
                      {x.unattributed && (
                        <Badge tone="caution" Icon={CircleHelp}>
                          Unattributed
                        </Badge>
                      )}
                    </span>
                  </span>
                  <span className={`num shrink-0 text-right ${incoming ? 'font-semibold text-income' : ''}`}>
                    {incoming ? amount(x.cents) : amount(-x.cents)}
                    <span className="block text-small font-normal">{incoming ? 'received' : 'delivered'}</span>
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </Panel>
  )
}
