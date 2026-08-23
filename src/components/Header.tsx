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
    <header className="h-8 border-b border-rule bg-surface">
      <div className="mx-auto flex h-full max-w-page items-center justify-between gap-2 px-6">
        <div className="flex items-baseline gap-1">
          <span className="font-wordmark text-body font-semibold tracking-tight text-ink">
            ECOFIBRE
          </span>
          <span className="text-ink-30" aria-hidden>
            /
          </span>
          <span className="text-body text-ink-50">Polyco Healthline</span>
        </div>

        <div className="flex items-baseline gap-2">
          {user.role === 'admin' && (
            <button type="button" onClick={() => navigate(ADMIN)} className="btn-text no-print">
              People
            </button>
          )}
          <button type="button" onClick={() => navigate(ACCOUNT)} className="btn-text">
            {user.name}
            <span className="text-ink-50"> · {ROLE_LABEL[user.role]}</span>
          </button>
          <button type="button" onClick={() => void signOut()} className="btn-text no-print">
            Sign out
          </button>
        </div>
      </div>
    </header>
  )
}
