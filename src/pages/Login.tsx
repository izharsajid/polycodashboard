import { useState, type FormEvent } from 'react'
import { useSession } from '../auth/session'
import { navigate } from '../lib/navigation'
import { FORGOT } from '../lib/router'

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
    <main className="min-h-screen flex items-start justify-center px-3 py-12">
      <div className="w-full max-w-sm">
        <div className="flex items-baseline gap-2 mb-4">
          <span className="text-body font-semibold tracking-tight">ECOFIBRE</span>
          <span className="text-ink-50">/</span>
          <span className="text-body text-ink-70">Polyco Healthline</span>
        </div>

        <h1 className="text-title font-semibold tracking-tight mb-1">Sign in</h1>
        <p className="text-body text-ink-70 mb-4">
          Position, capacity and configuration.
        </p>

        <form onSubmit={submit} className="flex flex-col gap-2">
          <label className="flex flex-col gap-1">
            <span className="eyebrow">Email</span>
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

          <label className="flex flex-col gap-1">
            <span className="eyebrow">Password</span>
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
            <p role="alert" className="border-l-2 border-critical pl-2 py-1 text-body text-ink">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="btn-primary mt-1 w-full disabled:opacity-50"
          >
            {busy ? 'Signing in' : 'Sign in'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => navigate(FORGOT)}
          className="mt-3 btn-text"
        >
          Forgotten your password?
        </button>
      </div>
    </main>
  )
}
