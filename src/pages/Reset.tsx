import { useState, type FormEvent } from 'react'
import type { PublicUser } from '../../netlify/lib/http'
import { useSession } from '../auth/session'
import { api } from '../lib/api'
import { navigate } from '../lib/navigation'
import { DASHBOARD, FORGOT } from '../lib/router'
import AuthShell from '../components/AuthShell'

/**
 * Setting a new password from a reset link. The token comes from the fragment, as
 * the invitation does, so it never reaches a server log.
 *
 * Unlike the invitation page this does not check the token before showing the
 * form, and so does not display the address the link belongs to. AUTH-SPEC
 * section 8 calls the two pages the same shape, and this is the one place they
 * differ. Showing the address would need an endpoint that section 5 does not
 * have, and it would tell whoever found the link whose account it opens. The
 * person resetting typed their own address into the previous page a moment ago,
 * so it tells them nothing they do not know.
 */
export default function Reset({ token }: { token: string | null }) {
  const { adopt } = useSession()
  const [password, setPassword] = useState('')
  const [again, setAgain] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [dead, setDead] = useState(false)
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    if (password !== again) {
      setError('Those two do not match. Type the same one twice.')
      return
    }

    setBusy(true)
    const result = await api.post<{ user: PublicUser }>('/api/auth/reset', { token, password })

    if (!result.ok) {
      setBusy(false)
      // 410 is the link itself being gone, which is worth saying plainly rather
      // than leaving somebody retyping. Anything else, a refused password most
      // likely, is worth another go on the same link.
      if (result.status === 410) setDead(true)
      else setError(result.error)
      return
    }

    adopt(result.data.user)
    navigate(DASHBOARD, { replace: true })
  }

  return (
    <AuthShell>

        {dead || !token ? (
          <>
            <h1 className="title mb-2">That link has expired</h1>
            <p className="lede mb-4">
              Reset links last an hour and work once. Ask for another and this one stops
              working either way.
            </p>
            <button
              type="button"
              onClick={() => navigate(FORGOT)}
              className="btn-text"
            >
              Send me a new link
            </button>
          </>
        ) : (
          <>
            <h1 className="title mb-2">Choose a new password</h1>
            <p className="lede mb-4">
              At least 12 characters. Setting it signs out every session on this account,
              including any you did not start.
            </p>

            <form onSubmit={submit} className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="kicker">New password</span>
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
