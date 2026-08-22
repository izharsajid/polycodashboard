import { useState } from 'react'
import ledgerRaw from '../data/polyco-ledger.json'
import statementsRaw from '../data/monthly-funding-statements.json'
import { Ledger, Statements } from './lib/schema'
import Tab1Position from './tabs/Tab1Position'
import Tab2Funding from './tabs/Tab2Funding'
import { isPartner, visible } from './redaction'

const ledger = Ledger.parse(ledgerRaw)
const statements = Statements.parse(statementsRaw)

const TABS = [
  { section: 'polyco-position', label: 'Where we stand', built: true },
  { section: 'funding-statements', label: 'Funding statements', built: true },
  { section: 'order-book', label: 'Still to be made', built: false },
  { section: 'capacity', label: 'Capacity', built: false },
  { section: 'configurations', label: 'Configurations', built: false },
  { section: 'roadmap', label: 'Path to 8', built: false },
  { section: 'scenarios', label: 'Scenarios', built: false },
  { section: 'assumptions', label: 'Assumptions', built: false },
] as const

export default function App() {
  const [active, setActive] = useState<string>('polyco-position')

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
          {TABS.filter((t) => visible(t.section)).map((t) =>
            t.built ? (
              <button
                key={t.section}
                onClick={() => setActive(t.section)}
                className={`py-3 text-sm whitespace-nowrap border-b-2 ${
                  active === t.section
                    ? 'border-leaf font-semibold'
                    : 'border-transparent text-ink-muted hover:text-ink'
                }`}
              >
                {t.label}
              </button>
            ) : (
              <span
                key={t.section}
                title="In preparation"
                className="py-3 text-sm whitespace-nowrap border-b-2 border-transparent text-ink-faint cursor-default"
              >
                {t.label}
              </span>
            ),
          )}
        </div>
      </nav>

      <main className="mx-auto max-w-6xl px-6 py-10">
        {active === 'polyco-position' && <Tab1Position ledger={ledger} />}
        {active === 'funding-statements' && <Tab2Funding statements={statements} />}
      </main>
    </div>
  )
}
