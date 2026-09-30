import { LogIn, LogOut, User, Users } from 'lucide-react'
import type { PublicUser } from '../../netlify/lib/http'
import { useSession } from '../auth/session'
import { navigate } from '../lib/navigation'
import { ACCOUNT, ADMIN, DASHBOARD, loginPathFor } from '../lib/router'
import Wordmark from './Wordmark'

/** Whose dashboard this is, and who is signed in, on every page. */
export default function Header({ user }: { user: PublicUser | null }) {
  const { signOut } = useSession()

  return (
    <header className="border-b-2 border-press bg-sheet">
      <div className="mx-auto flex min-h-[52px] max-w-page items-center justify-between gap-3 px-4 py-2 sm:px-6">
        <button type="button" onClick={() => navigate(DASHBOARD)} className="min-h-[44px] min-w-0 text-left" aria-label="EcoFibre funding dashboard, home">
          <Wordmark compact />
        </button>

        {user ? (
          <div className="flex min-w-0 items-center gap-4">
            {user.role === 'admin' && (
              <button type="button" onClick={() => navigate(ADMIN)} className="btn-text no-print">
                <Users size={14} aria-hidden />
                People
              </button>
            )}
            <button type="button" onClick={() => navigate(ACCOUNT)} className="btn-text no-print min-w-0" aria-label={`Your account: ${user.name}`}>
              <User size={14} aria-hidden className="shrink-0" />
              <span className="max-w-[10rem] truncate">{user.name}</span>
            </button>
            <button type="button" onClick={() => void signOut()} className="btn-text no-print">
              <LogOut size={14} aria-hidden />
              <span className="hidden sm:inline">Sign out</span>
              <span className="sr-only sm:hidden">Sign out</span>
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => navigate(loginPathFor('/'))} className="btn-text no-print">
            <LogIn size={14} aria-hidden /> Sign in
          </button>
        )}
      </div>
    </header>
  )
}
