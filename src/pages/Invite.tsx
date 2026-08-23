import { useEffect, useState, type FormEvent } from 'react'
import type { PublicUser } from '../../netlify/lib/http'
import { useSession } from '../auth/session'
import { api } from '../lib/api'
import { navigate } from '../lib/navigation'
import { DASHBOARD, LOGIN } from '../lib/router'

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

export default function Invite({ token }: { token: string | null }) {
  const { adopt } = useSession()
  const [stage, setStage] = useState<Stage>({ at: 'checking' })
  const [password, setPassword] = useState('')
  const [again, setAgain] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

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
      // 410 means the link is gone, so send them back to the dead-link state
      // rather than showing it as something they could retype their way out of.
      if (result.status === 410) setStage({ at: 'dead' })
      else setError(result.error)
      setBusy(false)
      return
    }

    // The server has set the cookie and signed them in already.
    adopt(result.data.user)
    navigate(DASHBOARD, { replace: true })
  }

  return (
    <main className="min-h-screen flex items-start justify-center px-3 py-12">
      <div className="w-full max-w-sm">
        <div className="flex items-baseline gap-2 mb-4">
          <span className="text-body font-semibold tracking-tight">ECOFIBRE</span>
          <span className="text-ink-50">/</span>
          <span className="text-body text-ink-70">Polyco Healthline</span>
        </div>

        {stage.at === 'checking' && (
          <p className="text-body text-ink-70" aria-busy="true">
            Checking that link.
          </p>
        )}

        {stage.at === 'dead' && (
          <>
            <h1 className="text-title font-semibold tracking-tight mb-1">That link has expired</h1>
            <p className="text-body text-ink-70 leading-relaxed mb-4">
              Invitations last seven days and work once. Ask whoever invited you for
              another, and this one stops working either way.
            </p>
            <button
              type="button"
              onClick={() => navigate(LOGIN)}
              className="text-body text-ink-70 underline underline-offset-2 hover:text-ink"
            >
              Go to sign in
            </button>
          </>
        )}

        {stage.at === 'ready' && (
          <>
            <h1 className="text-title font-semibold tracking-tight mb-1">Choose a password</h1>
            <p className="text-body text-ink-70 leading-relaxed mb-4">
              For <span className="text-ink">{stage.email}</span>. At least 12 characters. A
              few words you will remember beat a short one with symbols in it, and nobody
              here can see what you choose.
            </p>

            <form onSubmit={submit} className="flex flex-col gap-2">
              <label className="flex flex-col gap-1">
                <span className="eyebrow">Password</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  autoFocus
                  required
                  className="rulebox px-2 py-1 text-body"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="eyebrow">Again</span>
                <input
                  type="password"
                  value={again}
                  onChange={(e) => setAgain(e.target.value)}
                  autoComplete="new-password"
                  required
                  className="rulebox px-2 py-1 text-body"
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
                className="bg-accent text-white text-body font-semibold py-2 mt-1 disabled:opacity-50"
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
