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
    <main className="min-h-screen flex items-start justify-center px-6 py-24">
      <div className="w-full max-w-sm">
        <div className="flex items-baseline gap-3 mb-8">
          <span className="text-sm font-bold tracking-tight">ECOFIBRE</span>
          <span className="text-ink-faint">/</span>
          <span className="text-sm text-ink-muted">Polyco Healthline</span>
        </div>

        {dead || !token ? (
          <>
            <h1 className="text-xl font-semibold tracking-tight mb-1">That link has expired</h1>
            <p className="text-sm text-ink-muted leading-relaxed mb-8">
              Reset links last an hour and work once. Ask for another and this one stops
              working either way.
            </p>
            <button
              type="button"
              onClick={() => navigate(FORGOT)}
              className="text-sm text-ink-muted underline underline-offset-2 hover:text-ink"
            >
              Send me a new link
            </button>
          </>
        ) : (
          <>
            <h1 className="text-xl font-semibold tracking-tight mb-1">Choose a new password</h1>
            <p className="text-sm text-ink-muted leading-relaxed mb-8">
              At least 12 characters. Setting it signs out every session on this account,
              including any you did not start.
            </p>

            <form onSubmit={submit} className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="eyebrow">New password</span>
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
