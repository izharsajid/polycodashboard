import { useState } from 'react'
import Header from './components/Header'
import { TABS } from './tabs'

/**
 * The dashboard, open to anyone with the address. Sign-in was removed on
 * 1 October 2026 at Izhar's direction; the site carries a noindex tag and a
 * robots.txt so it stays out of search results, but it is not private.
 */
export default function App() {
  const [active, setActive] = useState<string>(TABS[0].id)
  const tab = TABS.find((t) => t.id === active) ?? TABS[0]

  return (
    <div className="min-h-screen">
      <Header />

      {/* The strip appears once there is a second tab to switch to. One tab
          needs no switch, and a strip holding a single label reads as a stub. */}
      {TABS.length > 1 && (
        <nav className="no-print border-b border-rule bg-sheet" aria-label="Dashboard sections">
          <div className="mx-auto flex max-w-page gap-1 overflow-x-auto px-4 sm:px-6" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={t.id === tab.id}
                onClick={() => setActive(t.id)}
                className={`min-h-[44px] whitespace-nowrap border-b-3 px-3 text-table font-semibold ${
                  t.id === tab.id ? 'border-marking text-press' : 'border-transparent text-press-2 hover:text-press'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </nav>
      )}

      <main className="mx-auto max-w-page px-4 pb-12 sm:px-6">
        <tab.Component />
      </main>
    </div>
  )
}
