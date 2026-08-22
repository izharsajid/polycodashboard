import { useState, type FormEvent } from 'react'
import type { PublicUser } from '../../netlify/lib/http'
import Header from '../components/Header'
import { api } from '../lib/api'
import { whenLocal } from '../lib/format'
import { navigate } from '../lib/navigation'
import { DASHBOARD } from '../lib/router'

const ROLE_LABEL: Record<PublicUser['role'], string> = {
  admin: 'Administrator',
  member: 'Member',
}

/** Change your own password, and see when you last signed in. */
export default function Account({ user }: { user: PublicUser }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [again, setAgain] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setDone(null)

    if (next !== again) {
      setError('The two new ones do not match. Type the same one twice.')
      return
    }

    setBusy(true)
    const result = await api.post<{ otherSessionsSignedOut: number }>('/api/auth/password', {
      currentPassword: current,
      newPassword: next,
    })
    setBusy(false)

    if (!result.ok) {
      setError(result.error)
      return
    }

    setCurrent('')
    setNext('')
    setAgain('')

    const others = result.data.otherSessionsSignedOut
    setDone(
      others === 0
        ? 'Password changed. You were not signed in anywhere else.'
        : `Password changed. ${others} other ${others === 1 ? 'session was' : 'sessions were'} signed out.`,
    )
  }

  return (
    <div className="min-h-screen">
      <Header user={user} />

      <main className="mx-auto max-w-2xl px-6 py-10">
        <header className="mb-8 border-b border-rule pb-4">
          <h1 className="text-xl font-semibold tracking-tight">Your account</h1>
        </header>

        <dl className="grid grid-cols-[9rem_1fr] gap-y-3 text-sm mb-12">
          <dt className="eyebrow self-center">Name</dt>
          <dd>{user.name}</dd>
          <dt className="eyebrow self-center">Email</dt>
          <dd>{user.email}</dd>
          <dt className="eyebrow self-center">Role</dt>
          <dd>{ROLE_LABEL[user.role]}</dd>
          <dt className="eyebrow self-center">Signed in</dt>
          <dd className="num text-[13px]">{whenLocal(user.lastLoginAt)}</dd>
        </dl>

        <section className="max-w-sm">
          <h2 className="text-base font-semibold tracking-tight mb-1">Change your password</h2>
          <p className="text-sm text-ink-muted leading-relaxed mb-6">
            At least 12 characters. A few words you will remember beat a short one with
            symbols in it. Changing it signs you out everywhere else, but not here.
          </p>

          <form onSubmit={submit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="eyebrow">Current password</span>
              <input
                type="password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                autoComplete="current-password"
                required
                className="rulebox px-3 py-2 text-sm"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="eyebrow">New password</span>
              <input
                type="password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                autoComplete="new-password"
                required
                className="rulebox px-3 py-2 text-sm"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="eyebrow">New password again</span>
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
            {done && (
              <p role="status" className="border-l-2 border-leaf pl-3 py-1 text-sm text-ink">
                {done}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="bg-leaf-deep text-white text-sm font-semibold py-2.5 mt-2 disabled:opacity-50"
            >
              {busy ? 'Changing it' : 'Change password'}
            </button>
          </form>
        </section>

        <button
          type="button"
          onClick={() => navigate(DASHBOARD)}
          className="mt-10 text-sm text-ink-muted underline underline-offset-2 hover:text-ink"
        >
          Back to the dashboard
        </button>
      </main>
    </div>
  )
}
