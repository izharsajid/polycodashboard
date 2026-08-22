import { useState, type FormEvent } from 'react'
import { api } from '../lib/api'
import { navigate } from '../lib/navigation'
import { LOGIN } from '../lib/router'

/**
 * The server answers the same way whether or not the address has an account, so
 * this page shows the same thing every time it succeeds. Do not add a branch that
 * tells the two apart.
 *
 * Nothing is actually sent yet. See netlify/lib/delivery.ts.
 */
export default function Forgot() {
  const [email, setEmail] = useState('')
  const [asked, setAsked] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)

    const result = await api.post('/api/auth/forgot', { email })
    setBusy(false)
    if (result.ok) setAsked(true)
    else setError(result.error)
  }

  return (
    <main className="min-h-screen flex items-start justify-center px-6 py-24">
      <div className="w-full max-w-sm">
        <div className="flex items-baseline gap-3 mb-8">
          <span className="text-sm font-bold tracking-tight">ECOFIBRE</span>
          <span className="text-ink-faint">/</span>
          <span className="text-sm text-ink-muted">Polyco Healthline</span>
        </div>

        <h1 className="text-xl font-semibold tracking-tight mb-1">Reset your password</h1>

        {asked ? (
          <>
            <p className="text-sm text-ink-muted leading-relaxed mb-8">
              If that address has an account, a reset link is on its way. It works once
              and lasts an hour.
            </p>
            <button
              type="button"
              onClick={() => navigate(LOGIN)}
              className="text-sm text-ink-muted underline underline-offset-2 hover:text-ink"
            >
              Back to sign in
            </button>
          </>
        ) : (
          <>
            <p className="text-sm text-ink-muted leading-relaxed mb-8">
              Give us the address you sign in with and we will send a link to set a new
              password.
            </p>

            <form onSubmit={submit} className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="eyebrow">Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  autoFocus
                  required
                  className="rulebox px-3 py-2 text-sm"
                />
              </label>

              {error && (
                <p role="alert" className="border-l-2 border-alert pl-3 py-1 text-sm text-ink">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={busy}
                className="bg-leaf-deep text-white text-sm font-semibold py-2.5 mt-2 disabled:opacity-50"
              >
                {busy ? 'Sending' : 'Send the link'}
              </button>
            </form>

            <button
              type="button"
              onClick={() => navigate(LOGIN)}
              className="mt-6 text-sm text-ink-muted underline underline-offset-2 hover:text-ink"
            >
              Back to sign in
            </button>
          </>
        )}
      </div>
    </main>
  )
}
