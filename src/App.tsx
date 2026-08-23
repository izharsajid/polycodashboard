import { useEffect, useState } from 'react'
import type { PublicUser } from '../netlify/lib/http'
import { SessionProvider, useSession } from './auth/session'
import Header from './components/Header'
import { useDashboardData } from './data/useDashboardData'
import { navigate, useLocation } from './lib/navigation'
import {
  ACCOUNT,
  ADMIN,
  DASHBOARD,
  FORGOT,
  INVITE,
  LOGIN,
  RESET,
  loginPathFor,
  nextFrom,
  tokenFromHash,
} from './lib/router'
import Account from './pages/Account'
import Admin from './pages/Admin'
import Forgot from './pages/Forgot'
import Invite from './pages/Invite'
import Login from './pages/Login'
import Reset from './pages/Reset'
import Tab1Position from './tabs/Tab1Position'
import Tab2Funding from './tabs/Tab2Funding'
import Tab3Statement from './tabs/Tab3Statement'
import Tab4Orders from './tabs/Tab4Orders'

const TABS = [
  { section: 'polyco-position', label: 'Where we stand', built: true },
  { section: 'funding-statements', label: 'Funding statements', built: true },
  // Next to Tab 1: Tab 1 states the position and this is the evidence for it.
  { section: 'statement', label: 'Statement', built: true },
  { section: 'order-book', label: 'Still to be made', built: true },
  { section: 'capacity', label: 'Capacity', built: false },
  { section: 'configurations', label: 'Configurations', built: false },
  { section: 'roadmap', label: 'Path to 8', built: false },
  { section: 'scenarios', label: 'Scenarios', built: false },
  { section: 'assumptions', label: 'Assumptions', built: false },
] as const

export default function App() {
  return (
    <SessionProvider>
      <Routed />
    </SessionProvider>
  )
}

function Routed() {
  const session = useSession()
  const { path, search, hash } = useLocation()

  // Nothing at all until the server has said who this is. Rendering the
  // dashboard first and taking it away looks like a flicker and reads like a
  // leak.
  if (session.status === 'loading') return <Waiting />

  // These two run signed in or out. Somebody already holding a session may still
  // be opening a link for a different address, and the token decides whose
  // account it touches, not the cookie.
  //
  // Keyed on the token so that opening a second link in the same tab starts the
  // page again rather than showing what the first one ended up on. A fragment
  // change does not reload the document.
  const token = tokenFromHash(hash)
  if (path === INVITE) return <Invite key={hash} token={token} />
  if (path === RESET) return <Reset key={hash} token={token} />

  if (session.status === 'out') {
    if (path === LOGIN) return <Login next={nextFrom(search)} />
    if (path === FORGOT) return <Forgot />
    return <Send to={loginPathFor(path)} />
  }

  // Signed in and standing on a page that only makes sense signed out.
  if (path === LOGIN || path === FORGOT) return <Send to={DASHBOARD} />

  if (path === ACCOUNT) return <Account user={session.user} />

  // A member who types the address gets the dashboard rather than a refusal.
  // There is nothing here to tell them about, and the endpoints refuse them
  // anyway, which is where the actual control lives.
  if (path === ADMIN) {
    return session.user.role === 'admin' ? (
      <Admin user={session.user} />
    ) : (
      <Send to={DASHBOARD} />
    )
  }

  return <Dashboard user={session.user} />
}

function Waiting() {
  return <div className="min-h-screen" aria-busy="true" />
}

function Send({ to }: { to: string }) {
  useEffect(() => {
    navigate(to, { replace: true })
  }, [to])
  return <Waiting />
}

function Dashboard({ user }: { user: PublicUser }) {
  const [active, setActive] = useState<string>('polyco-position')
  const figures = useDashboardData()

  return (
    <div className="min-h-screen">
      <Header user={user} />

      {/* A single row of text items. Active is ink with a 2px accent underline;
          inactive is ink-50. No pills, no boxes, no fills.
          DESIGN-SYSTEM-SPEC section 5. */}
      <nav className="border-b border-rule bg-paper no-print">
        <div className="mx-auto flex max-w-page gap-3 overflow-x-auto px-6">
          {TABS.map((t) =>
            t.built ? (
              <button
                key={t.section}
                onClick={() => setActive(t.section)}
                aria-current={active === t.section ? 'page' : undefined}
                className={`-mb-px whitespace-nowrap border-b-2 py-2 text-body ${
                  active === t.section
                    ? 'border-accent font-medium text-ink'
                    : 'border-transparent text-ink-50 hover:text-ink'
                }`}
              >
                {t.label}
              </button>
            ) : (
              <span
                key={t.section}
                title="In preparation"
                className="cursor-default whitespace-nowrap border-b-2 border-transparent py-2 text-body text-ink-30"
              >
                {t.label}
              </span>
            ),
          )}
        </div>
      </nav>

      <main className="mx-auto max-w-page px-[20px] py-6 sm:px-6">
        {figures.status === 'loading' && (
          <p className="text-body text-ink-70" aria-busy="true">
            Loading the figures.
          </p>
        )}

        {figures.status === 'failed' && (
          <p role="alert" className="border-l-2 border-critical pl-2 py-1 text-body text-ink max-w-2xl">
            {figures.error}
          </p>
        )}

        {figures.status === 'ready' && (
          <>
            {active === 'polyco-position' && <Tab1Position ledger={figures.data.ledger} />}
            {active === 'funding-statements' && <Tab2Funding statements={figures.data.statements} />}
            {active === 'statement' && (
              <Tab3Statement ledger={figures.data.ledger} who={user.email} />
            )}
            {active === 'order-book' && (
              <Tab4Orders
                tracker={figures.data.poTracker}
                ledger={figures.data.ledger}
                isAdmin={user.role === 'admin'}
              />
            )}
          </>
        )}
      </main>
    </div>
  )
}
