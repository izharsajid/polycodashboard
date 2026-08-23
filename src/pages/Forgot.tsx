import { useState, type FormEvent } from 'react'
import { api } from '../lib/api'
import { navigate } from '../lib/navigation'
import { LOGIN } from '../lib/router'
import AuthShell from '../components/AuthShell'

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
    <AuthShell>

        <h1 className="title mb-2">Reset your password</h1>

        {asked ? (
          <>
            <p className="lede mb-4">
              If that address has an account, a reset link is on its way. It works once
              and lasts an hour.
            </p>
            <button
              type="button"
              onClick={() => navigate(LOGIN)}
              className="btn-text"
            >
              Back to sign in
            </button>
          </>
        ) : (
          <>
            <p className="lede mb-4">
              Give us the address you sign in with and we will send a link to set a new
              password.
            </p>

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

              {error && (
                <p role="alert" className="rounded border-l-2 border-critical bg-critical-wash py-2 pl-3 pr-3 text-table text-ink">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={busy}
                className="btn-primary w-full justify-center disabled:opacity-50"
              >
                {busy ? 'Sending' : 'Send the link'}
              </button>
            </form>

            <button
              type="button"
              onClick={() => navigate(LOGIN)}
              className="mt-3 btn-text"
            >
              Back to sign in
            </button>
          </>
        )}
    </AuthShell>
  )
}
