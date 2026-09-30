import { useEffect, useState } from 'react'
import type { PublicUser } from '../netlify/lib/http'
import { SessionProvider, useSession } from './auth/session'
import Header from './components/Header'
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
import { TABS } from './tabs'

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
  const [active, setActive] = useState<string>(TABS[0].id)
  const tab = TABS.find((t) => t.id === active) ?? TABS[0]

  return (
    <div className="min-h-screen">
      <Header user={user} />

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
