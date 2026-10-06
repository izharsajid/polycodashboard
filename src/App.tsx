import { AnimatePresence, LayoutGroup, LazyMotion, MotionConfig } from 'motion/react'
import * as m from 'motion/react-m'
import { Suspense, useEffect, useState } from 'react'
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
import Loading from './components/Loading'
import { prefetch } from './data/cache'
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

/** Motion's features arrive in their own small file once the page is up. */
const loadMotion = () => import('./lib/motionFeatures').then((f) => f.default)

function Dashboard({ user }: { user: PublicUser | null }) {
  // Remembered for the tab, so signing in to make a change brings you back to
  // the tab you were on.
  const [active, setActive] = useState<string>(() => {
    // A link can open a tab directly: ?tab=machines.
    const linked = new URLSearchParams(window.location.search).get('tab')
    if (linked && TABS.some((t) => t.id === linked)) return linked
    try {
      return sessionStorage.getItem(TAB_KEY) ?? TABS[0].id
    } catch {
      return TABS[0].id
    }
  })
  const tab = TABS.find((t) => t.id === active) ?? TABS[0]
  // Every tab's data starts loading as soon as the dashboard opens, so moving
  // between tabs shows it straight away.
  useEffect(() => {
    prefetch(['/api/tracker', '/api/machines', '/api/statement', '/api/data', '/api/inventory'])
  }, [])
  const choose = (id: string) => {
    setActive(id)
    try {
      sessionStorage.setItem(TAB_KEY, id)
    } catch {
      // Private browsing: the choice lasts as long as the page.
    }
  }

  return (
    <LazyMotion features={loadMotion} strict>
    <MotionConfig reducedMotion="user">
    <div className="min-h-screen">
      {/* One dark band holds the name, the live status and the tabs, and stays in reach. */}
      <div className="sticky top-0 z-30 bg-press shadow-lift print:static print:bg-sheet">
      <Header user={user} />

      {TABS.length > 1 && (
        <nav className="no-print" aria-label="Dashboard sections">
          <LayoutGroup>
          <div className="scrollbar-none mx-auto flex max-w-page gap-1 overflow-x-auto px-2 sm:px-4" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={t.id === tab.id}
                onClick={() => choose(t.id)}
                onPointerEnter={t.preload}
                onFocus={t.preload}
                className={`relative min-h-[44px] whitespace-nowrap px-3 text-table font-semibold transition-colors duration-150 ${
                  t.id === tab.id ? 'text-sheet' : 'text-sheet/65 hover:text-sheet'
                }`}
              >
                {t.label}
                {t.id === tab.id && (
                  <m.span
                    layoutId="tab-marker"
                    className="absolute inset-x-2 bottom-0 h-[3px] rounded-t-full bg-marking"
                    transition={{ type: 'spring', stiffness: 520, damping: 40 }}
                    aria-hidden
                  />
                )}
              </button>
            ))}
          </div>
          </LayoutGroup>
        </nav>
      )}
      </div>

      <main className="mx-auto max-w-page px-4 pb-12 sm:px-6">
        <AnimatePresence mode="wait" initial={false}>
          <m.div
            key={tab.id}
            initial={{ opacity: 0, y: 10, filter: 'blur(2px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -6, transition: { duration: 0.12 } }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          >
            <Suspense fallback={<Loading label="Loading this tab." />}>
              <tab.Component />
            </Suspense>
          </m.div>
        </AnimatePresence>
      </main>
    </div>
    </MotionConfig>
    </LazyMotion>
  )
}
