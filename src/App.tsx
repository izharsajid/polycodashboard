import ledgerRaw from '../data/polyco-ledger.json'
import { Ledger } from './lib/schema'
import Tab1Position from './tabs/Tab1Position'
import { isPartner } from './redaction'

const ledger = Ledger.parse(ledgerRaw)

export default function App() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-rule bg-white">
        <div className="mx-auto max-w-6xl px-6 py-4 flex flex-wrap items-baseline justify-between gap-2">
          <div className="flex items-baseline gap-3">
            <span className="text-sm font-bold tracking-tight">ECOFIBRE</span>
            <span className="text-ink-faint">/</span>
            <span className="text-sm text-ink-muted">Polyco Healthline</span>
          </div>
          <span className="eyebrow">
            Position, capacity and configuration{isPartner ? '' : ' · internal'}
          </span>
        </div>
      </header>

      <nav className="border-b border-rule bg-paper-panel no-print">
        <div className="mx-auto max-w-6xl px-6 flex gap-6 overflow-x-auto">
          {[
            'Where we stand', 'Funding statements', 'Still to be made', 'Capacity',
            'Configurations', 'Path to 8', 'Scenarios', 'Assumptions',
          ].map((t, i) => (
            <span
              key={t}
              className={`py-3 text-sm whitespace-nowrap border-b-2 ${
                i === 0
                  ? 'border-leaf font-semibold'
                  : 'border-transparent text-ink-faint'
              }`}
            >
              {t}
            </span>
          ))}
        </div>
      </nav>

      <main className="mx-auto max-w-6xl px-6 py-10">
        <Tab1Position ledger={ledger} />
      </main>
    </div>
  )
}
