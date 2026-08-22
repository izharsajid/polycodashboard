import type { PublicUser } from '../../netlify/lib/http'
import { useSession } from '../auth/session'
import { navigate } from '../lib/navigation'
import { ACCOUNT } from '../lib/router'

const ROLE_LABEL: Record<PublicUser['role'], string> = {
  admin: 'Administrator',
  member: 'Member',
}

/** On every page, per AUTH-SPEC section 8: who you are, what you are, and the way out. */
export default function Header({ user }: { user: PublicUser }) {
  const { signOut } = useSession()

  return (
    <header className="border-b border-rule bg-white">
      <div className="mx-auto max-w-6xl px-6 py-4 flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <span className="text-sm font-bold tracking-tight">ECOFIBRE</span>
          <span className="text-ink-faint">/</span>
          <span className="text-sm text-ink-muted">Polyco Healthline</span>
        </div>

        <div className="flex items-baseline gap-4">
          <span className="eyebrow">Position, capacity and configuration</span>
          <span className="text-ink-faint no-print">|</span>
          <button
            type="button"
            onClick={() => navigate(ACCOUNT)}
            className="text-sm text-ink-muted hover:text-ink underline underline-offset-2 decoration-rule-strong"
          >
            {user.name}
            <span className="text-ink-faint"> · {ROLE_LABEL[user.role]}</span>
          </button>
          <button
            type="button"
            onClick={() => void signOut()}
            className="no-print text-sm text-ink-muted underline underline-offset-2 hover:text-ink"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  )
}
