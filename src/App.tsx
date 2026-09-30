import { useEffect, useState } from 'react'
import type { PublicUser } from '../netlify/lib/http'
import { SessionProvider, useSession } from './auth/session'
import Header from './components/Header'
import { navigate, useLocation } from './lib/navigation'
import { ACCOUNT, ADMIN, DASHBOARD, FORGOT, INVITE, LOGIN, RESET, loginPathFor, nextFrom, tokenFromHash } from './lib/router'
import Account from './pages/Account'
import Admin from './pages/Admin'
import Forgot from './pages/Forgot'
import Invite from './pages/Invite'
import Login from './pages/Login'
import Reset from './pages/Reset'
import { TABS } from './tabs'

/**
 * The dashboard is open to read without an account. Signing in is for making
 * changes (recording payments and invoices, fixing discrepancies, uploading
 * files) and, for an administrator, for adding people.
 */
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

  if (session.status === 'loading') return <Waiting />

  // Links run signed in or out: the token decides whose account they touch.
  const token = tokenFromHash(hash)
  if (path === INVITE) return <Invite key={hash} token={token} />
  if (path === RESET) return <Reset key={hash} token={token} />

  if (session.status === 'out') {
    if (path === LOGIN) return <Login next={nextFrom(search)} />
    if (path === FORGOT) return <Forgot />
    if (path === ACCOUNT || path === ADMIN) return <Send to={loginPathFor(path)} />
    return <Dashboard user={null} />
  }

  if (path === LOGIN || path === FORGOT) return <Send to={DASHBOARD} />
  if (path === ACCOUNT) return <Account user={session.user} />
  if (path === ADMIN) return session.user.role === 'admin' ? <Admin user={session.user} /> : <Send to={DASHBOARD} />
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

const TAB_KEY = 'ef-dashboard-tab'

function Dashboard({ user }: { user: PublicUser | null }) {
  // Remembered for the tab, so signing in to make a change brings you back to
  // the tab you were on.
  const [active, setActive] = useState<string>(() => {
    try {
      return sessionStorage.getItem(TAB_KEY) ?? TABS[0].id
    } catch {
      return TABS[0].id
    }
  })
  const tab = TABS.find((t) => t.id === active) ?? TABS[0]
  const choose = (id: string) => {
    setActive(id)
    try {
      sessionStorage.setItem(TAB_KEY, id)
    } catch {
      // Private browsing: the choice lasts as long as the page.
    }
  }

  return (
    <div className="min-h-screen">
      <Header user={user} />

      {TABS.length > 1 && (
        <nav className="no-print border-b border-rule bg-sheet" aria-label="Dashboard sections">
          <div className="mx-auto flex max-w-page gap-1 overflow-x-auto px-4 sm:px-6" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={t.id === tab.id}
                onClick={() => choose(t.id)}
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
