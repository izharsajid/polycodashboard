import { useEffect, useState, type FormEvent } from 'react'
import type { PublicUser } from '../../netlify/lib/http'
import { useSession } from '../auth/session'
import { api } from '../lib/api'
import { navigate } from '../lib/navigation'
import { DASHBOARD, LOGIN, tokenFromHash } from '../lib/router'

/**
 * Accepting an invitation. The token comes from the fragment, which the browser
 * keeps to itself, so it never reaches a server log on the way here.
 *
 * The page asks the server who the link is for before showing anything, so a dead
 * link says so immediately rather than after somebody has chosen a password.
 */
type Stage =
  | { at: 'checking' }
  | { at: 'dead' }
  | { at: 'ready'; email: string }

export default function Invite() {
  const { adopt } = useSession()
  const [stage, setStage] = useState<Stage>({ at: 'checking' })
  const [password, setPassword] = useState('')
  const [again, setAgain] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const token = tokenFromHash(window.location.hash)

  useEffect(() => {
    let live = true
    void (async () => {
      if (!token) {
        setStage({ at: 'dead' })
        return
      }
      const result = await api.post<{ email: string }>('/api/invitations/validate', { token })
      if (!live) return
      setStage(result.ok ? { at: 'ready', email: result.data.email } : { at: 'dead' })
    })()
    return () => {
      live = false
    }
  }, [token])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    if (password !== again) {
      setError('Those two do not match. Type the same one twice.')
      return
    }

    setBusy(true)
    const result = await api.post<{ user: PublicUser }>('/api/invitations/accept', {
      token,
      password,
    })

    if (!result.ok) {
      setError(result.error)
      setBusy(false)
      return
    }

    // The server has set the cookie and signed them in already.
    adopt(result.data.user)
    navigate(DASHBOARD, { replace: true })
  }

  return (
    <main className="min-h-screen flex items-start justify-center px-6 py-24">
      <div className="w-full max-w-sm">
        <div className="flex items-baseline gap-3 mb-8">
          <span className="text-sm font-bold tracking-tight">ECOFIBRE</span>
          <span className="text-ink-faint">/</span>
          <span className="text-sm text-ink-muted">Polyco Healthline</span>
        </div>

        {stage.at === 'checking' && (
          <p className="text-sm text-ink-muted" aria-busy="true">
            Checking that link.
          </p>
        )}

        {stage.at === 'dead' && (
          <>
            <h1 className="text-xl font-semibold tracking-tight mb-1">That link has expired</h1>
            <p className="text-sm text-ink-muted leading-relaxed mb-8">
              Invitations last seven days and work once. Ask whoever invited you for
              another, and this one stops working either way.
            </p>
            <button
              type="button"
              onClick={() => navigate(LOGIN)}
              className="text-sm text-ink-muted underline underline-offset-2 hover:text-ink"
            >
              Go to sign in
            </button>
          </>
        )}

        {stage.at === 'ready' && (
          <>
            <h1 className="text-xl font-semibold tracking-tight mb-1">Choose a password</h1>
            <p className="text-sm text-ink-muted leading-relaxed mb-8">
              For <span className="text-ink">{stage.email}</span>. At least 12 characters. A
              few words you will remember beat a short one with symbols in it, and nobody
              here can see what you choose.
            </p>

            <form onSubmit={submit} className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="eyebrow">Password</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  autoFocus
                  required
                  className="rulebox px-3 py-2 text-sm"
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="eyebrow">Again</span>
                <input
                  type="password"
                  value={again}
                  onChange={(e) => setAgain(e.target.value)}
                  autoComplete="new-password"
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
                {busy ? 'Setting it' : 'Set password and sign in'}
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  )
}
