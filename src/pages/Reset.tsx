import { useState, type FormEvent } from 'react'
import type { PublicUser } from '../../netlify/lib/http'
import { useSession } from '../auth/session'
import { api } from '../lib/api'
import { navigate } from '../lib/navigation'
import { DASHBOARD, FORGOT } from '../lib/router'

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
    <main className="min-h-screen flex items-start justify-center px-3 py-12">
      <div className="w-full max-w-sm">
        <div className="flex items-baseline gap-2 mb-4">
          <span className="text-body font-semibold tracking-tight">ECOFIBRE</span>
          <span className="text-ink-50">/</span>
          <span className="text-body text-ink-70">Polyco Healthline</span>
        </div>

        {dead || !token ? (
          <>
            <h1 className="text-title font-semibold tracking-tight mb-1">That link has expired</h1>
            <p className="text-body text-ink-70 leading-relaxed mb-4">
              Reset links last an hour and work once. Ask for another and this one stops
              working either way.
            </p>
            <button
              type="button"
              onClick={() => navigate(FORGOT)}
              className="text-body text-ink-70 underline underline-offset-2 hover:text-ink"
            >
              Send me a new link
            </button>
          </>
        ) : (
          <>
            <h1 className="text-title font-semibold tracking-tight mb-1">Choose a new password</h1>
            <p className="text-body text-ink-70 leading-relaxed mb-4">
              At least 12 characters. Setting it signs out every session on this account,
              including any you did not start.
            </p>

            <form onSubmit={submit} className="flex flex-col gap-2">
              <label className="flex flex-col gap-1">
                <span className="eyebrow">New password</span>
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
