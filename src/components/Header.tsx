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
      <div className="mx-auto max-w-6xl px-3 py-2 flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <span className="text-body font-semibold tracking-tight text-accent">ECOFIBRE</span>
          <span className="text-ink-50">/</span>
          <span className="text-body text-ink-70">Polyco Healthline</span>
        </div>

        <div className="flex items-baseline gap-2">
          <span className="eyebrow hidden sm:inline">Position, capacity and configuration</span>
          <span className="text-ink-50 no-print hidden sm:inline">|</span>
          {user.role === 'admin' && (
            <button
              type="button"
              onClick={() => navigate(ADMIN)}
              className="no-print text-body text-ink-70 underline underline-offset-2 hover:text-ink"
            >
              People
            </button>
          )}
          <button
            type="button"
            onClick={() => navigate(ACCOUNT)}
            className="text-body text-ink-70 hover:text-ink underline underline-offset-2 decoration-rule"
          >
            {user.name}
            <span className="text-ink-50"> · {ROLE_LABEL[user.role]}</span>
          </button>
          <button
            type="button"
            onClick={() => void signOut()}
            className="no-print text-body text-ink-70 underline underline-offset-2 hover:text-ink"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  )
}
