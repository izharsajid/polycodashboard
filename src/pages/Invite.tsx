import { useEffect, useState, type FormEvent } from 'react'
import type { PublicUser } from '../../netlify/lib/http'
import { useSession } from '../auth/session'
import { api } from '../lib/api'
import { navigate } from '../lib/navigation'
import { DASHBOARD, LOGIN } from '../lib/router'
import AuthShell from '../components/AuthShell'

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
    <AuthShell>

        {stage.at === 'checking' && (
          <p className="text-body text-ink-muted" aria-busy="true">
            Checking that link.
          </p>
        )}

        {stage.at === 'dead' && (
          <>
            <h1 className="title mb-2">That link has expired</h1>
            <p className="lede mb-4">
              Invitations last seven days and work once. Ask whoever invited you for
              another, and this one stops working either way.
            </p>
            <button
              type="button"
              onClick={() => navigate(LOGIN)}
              className="btn-text"
            >
              Go to sign in
            </button>
          </>
        )}

        {stage.at === 'ready' && (
          <>
            <h1 className="title mb-2">Choose a password</h1>
            <p className="lede mb-4">
              For <span className="text-ink">{stage.email}</span>. At least 12 characters. A
              few words you will remember beat a short one with symbols in it, and nobody
              here can see what you choose.
            </p>

            <form onSubmit={submit} className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="kicker">Password</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  autoFocus
                  required
                  className="field w-full"
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="kicker">Again</span>
                <input
                  type="password"
                  value={again}
                  onChange={(e) => setAgain(e.target.value)}
                  autoComplete="new-password"
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
                {busy ? 'Setting it' : 'Set password and sign in'}
              </button>
            </form>
          </>
        )}
    </AuthShell>
  )
}
