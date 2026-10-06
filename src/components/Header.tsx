import { LogIn, LogOut, User, Users } from 'lucide-react'
import type { PublicUser } from '../../netlify/lib/http'
import { useSession } from '../auth/session'
import { navigate } from '../lib/navigation'
import { ACCOUNT, ADMIN, DASHBOARD, loginPathFor } from '../lib/router'
import LiveStatus from './LiveStatus'
import Wordmark from './Wordmark'

/** Whose dashboard this is, and who is signed in, on every page. */
export default function Header({ user }: { user: PublicUser | null }) {
  const { signOut } = useSession()

  return (
    <header>
      <div className="mx-auto flex min-h-[56px] max-w-page items-center justify-between gap-3 px-4 py-2 sm:px-6">
        <button type="button" onClick={() => navigate(DASHBOARD)} className="min-h-[44px] min-w-0 text-left" aria-label="EcoFibre funding dashboard, home">
          <Wordmark compact onDark />
        </button>

        <div className="flex min-w-0 items-center gap-4">
        <span className="hidden md:inline-flex">
          <LiveStatus />
        </span>
        {user ? (
          <div className="flex min-w-0 items-center gap-4">
            {user.role === 'admin' && (
              <button type="button" onClick={() => navigate(ADMIN)} className="btn-text no-print text-sheet">
                <Users size={14} aria-hidden />
                People
              </button>
            )}
            <button type="button" onClick={() => navigate(ACCOUNT)} className="btn-text no-print text-sheet min-w-0" aria-label={`Your account: ${user.name}`}>
              <User size={14} aria-hidden className="shrink-0" />
              <span className="max-w-[10rem] truncate">{user.name}</span>
            </button>
            <button type="button" onClick={() => void signOut()} className="btn-text no-print text-sheet">
              <LogOut size={14} aria-hidden />
              <span className="hidden sm:inline">Sign out</span>
              <span className="sr-only sm:hidden">Sign out</span>
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => navigate(loginPathFor('/'))} className="btn-text no-print text-sheet">
            <LogIn size={14} aria-hidden /> Sign in
          </button>
        )}
        </div>
      </div>
    </header>
  )
}
