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
import Tab5Forecast from './tabs/Tab5Forecast'
import Tab6Machines from './tabs/Tab6Machines'

const TABS = [
  { section: 'polyco-position', label: 'Where we stand', built: true },
  { section: 'funding-statements', label: 'Funding statements', built: true },
  // Next to Tab 1: Tab 1 states the position and this is the evidence for it.
  { section: 'statement', label: 'Statement', built: true },
  { section: 'order-book', label: 'Still to be made', built: true },
  // The production half of the picture the forecast tab reads off the ledger.
  { section: 'machines', label: 'Machines', built: true },
  // The question Polyco actually has: where is this going?
  { section: 'forecast', label: 'Next six months', built: true },
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

  // The statement, the order table and the machine schedule are ledgers and need
  // the room. The tab strip has to widen with them, or the active tab stops
  // sitting flush against the card below it.
  const wide = active === 'statement' || active === 'order-book' || active === 'machines'

  return (
    <div className="min-h-screen">
      <Header user={user} />

      {/* Small tabs above the card, the active one white with a border and
          rounded top corners sitting flush against it. This is efdashboard's
          exact pattern. DESIGN-SYSTEM-V2-SPEC section 4. */}
      <nav className="no-print">
        <div
          className={`mx-auto flex gap-1 overflow-x-auto px-4 pt-4 sm:px-6 ${
            wide ? '' : 'max-w-page'
          }`}
        >
          {TABS.map((t) =>
            t.built ? (
              <button
                key={t.section}
                onClick={() => setActive(t.section)}
                aria-current={active === t.section ? 'page' : undefined}
                className={`tab ${active === t.section ? 'tab-active' : ''}`}
              >
                {t.label}
              </button>
            ) : (
              <span
                key={t.section}
                title="In preparation"
                className="tab cursor-default text-ink-muted opacity-50"
              >
                {t.label}
              </span>
            ),
          )}
        </div>
      </nav>

      <main
        className={`px-4 pb-8 sm:px-6 ${wide ? '' : 'mx-auto max-w-page'}`}
      >
        {figures.status === 'loading' && (
          <p className="card card-body text-body text-ink-muted" aria-busy="true">
            Loading the figures.
          </p>
        )}

        {figures.status === 'failed' && (
          <p role="alert" className="card card-body max-w-prose text-body text-critical">
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
            {active === 'forecast' && (
              <Tab5Forecast
                ledger={figures.data.ledger}
                tracker={figures.data.poTracker}
                statements={figures.data.statements}
                today={new Date().toISOString().slice(0, 10)}
              />
            )}
            {active === 'machines' && (
              <Tab6Machines
                schedule={figures.data.machineSchedule}
                ledger={figures.data.ledger}
                tracker={figures.data.poTracker}
              />
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
