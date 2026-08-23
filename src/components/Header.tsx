import { LogOut, User, Users } from 'lucide-react'
import type { PublicUser } from '../../netlify/lib/http'
import { useSession } from '../auth/session'
import { navigate } from '../lib/navigation'
import { ACCOUNT, ADMIN } from '../lib/router'

const ROLE_LABEL: Record<PublicUser['role'], string> = {
  admin: 'Administrator',
  member: 'Member',
}

/** On every page, per AUTH-SPEC section 8: who you are, what you are, and the way out. */
export default function Header({ user }: { user: PublicUser }) {
  const { signOut } = useSession()

  return (
    <header className="border-b border-rule bg-surface">
      <div className="mx-auto flex max-w-page items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="text-figure font-extrabold tracking-tight text-leaf-deep">
            ECOFIBRE
          </span>
          <span className="text-ink-muted" aria-hidden>
            /
          </span>
          <span className="hidden truncate text-table text-ink-muted sm:inline">
            Polyco Healthline
          </span>
        </div>

        <div className="flex min-w-0 items-center gap-3">
          {user.role === 'admin' && (
            <button type="button" onClick={() => navigate(ADMIN)} className="btn-text no-print">
              <Users size={13} aria-hidden />
              People
            </button>
          )}
          <button
            type="button"
            onClick={() => navigate(ACCOUNT)}
            className="btn-text min-w-0 truncate"
          >
            <User size={13} aria-hidden className="shrink-0" />
            <span className="truncate">{user.name}</span>
            <span className="hidden font-normal text-ink-muted sm:inline">
              · {ROLE_LABEL[user.role]}
            </span>
          </button>
          <button type="button" onClick={() => void signOut()} className="btn-text no-print">
            <LogOut size={13} aria-hidden />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </div>
    </header>
  )
}
