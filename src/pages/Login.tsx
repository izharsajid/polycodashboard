import { useState, type FormEvent } from 'react'
import { useSession } from '../auth/session'
import { navigate } from '../lib/navigation'
import { FORGOT } from '../lib/router'
import AuthShell from '../components/AuthShell'

/**
 * Email, password, a forgot-password link, nothing else.
 *
 * The failure message comes from the server and says the same thing whatever went
 * wrong, so this page cannot be used to find out who has an account. Do not add
 * anything here that distinguishes one failure from another.
 */
export default function Login({ next }: { next: string }) {
  const session = useSession()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)

    const result = await session.signIn(email, password)
    if (result.ok) navigate(next, { replace: true })
    else {
      setError(result.error)
      setBusy(false)
    }
  }

  return (
    <AuthShell
      title="Sign in"
      lede="Position, capacity and configuration."
      footer={
        <button type="button" onClick={() => navigate(FORGOT)} className="btn-text">
          Forgotten your password?
        </button>
      }
    >
        <form onSubmit={submit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="kicker">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              autoFocus
              required
              className="field w-full"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="kicker">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              className="field w-full"
            />
          </label>

          {error && (
            <p
              role="alert"
              className="rounded border-l-2 border-critical bg-critical-wash py-2 pl-3 pr-3 text-table text-ink"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="btn-primary w-full justify-center disabled:opacity-50"
          >
            {busy ? 'Signing in' : 'Sign in'}
          </button>
        </form>
    </AuthShell>
  )
}
