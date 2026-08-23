import { useState, type FormEvent } from 'react'
import type { PublicUser } from '../../netlify/lib/http'
import Header from '../components/Header'
import InviteForm from '../components/InviteForm'
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

      <main className="mx-auto max-w-2xl px-3 py-6">
        <header className="mb-4 border-b border-rule pb-2">
          <h1 className="text-title font-semibold tracking-tight">Your account</h1>
        </header>

        <dl className="grid grid-cols-[9rem_1fr] gap-y-2 text-body mb-6">
          <dt className="eyebrow self-center">Name</dt>
          <dd>{user.name}</dd>
          <dt className="eyebrow self-center">Email</dt>
          <dd>{user.email}</dd>
          <dt className="eyebrow self-center">Role</dt>
          <dd>{ROLE_LABEL[user.role]}</dd>
          <dt className="eyebrow self-center">Signed in</dt>
          <dd className="num text-label">{whenLocal(user.lastLoginAt)}</dd>
        </dl>

        <section className="max-w-sm">
          <h2 className="text-subtitle font-semibold tracking-tight mb-1">Change your password</h2>
          <p className="text-body text-ink-70 leading-relaxed mb-3">
            At least 12 characters. A few words you will remember beat a short one with
            symbols in it. Changing it signs you out everywhere else, but not here.
          </p>

          <form onSubmit={submit} className="flex flex-col gap-2">
            <label className="flex flex-col gap-1">
              <span className="eyebrow">Current password</span>
              <input
                type="password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                autoComplete="current-password"
                required
                className="field w-full"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="eyebrow">New password</span>
              <input
                type="password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                autoComplete="new-password"
                required
                className="field w-full"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="eyebrow">New password again</span>
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
              <p role="alert" className="border-l-2 border-critical pl-2 py-1 text-body text-ink">
                {error}
              </p>
            )}
            {done && (
              <p role="status" className="border-l-2 border-accent pl-2 py-1 text-body text-ink">
                {done}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="btn-primary mt-1 w-full disabled:opacity-50"
            >
              {busy ? 'Changing it' : 'Change password'}
            </button>
          </form>
        </section>

        <section className="mt-8 border-t border-rule pt-4">
          <h2 className="text-subtitle font-semibold tracking-tight mb-1">Invite a colleague</h2>
          <p className="text-body text-ink-70 leading-relaxed mb-3">
            They choose their own password from a link that works once. Nothing is sent
            while sending is switched off, so adding someone now tells them nothing.
          </p>
          <InviteForm actor={user} />
        </section>

        <button
          type="button"
          onClick={() => navigate(DASHBOARD)}
          className="mt-6 btn-text"
        >
          Back to the dashboard
        </button>
      </main>
    </div>
  )
}
