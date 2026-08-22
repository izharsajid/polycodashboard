import { useState, type FormEvent } from 'react'
import type { PublicUser } from '../../netlify/lib/http'
import { api } from '../lib/api'

/**
 * Used on both the admin panel and the account page, because AUTH-SPEC section 1
 * lets a member invite a colleague at their own domain as well.
 *
 * The role selector only appears for an administrator, and that is a convenience,
 * not the control: the server refuses a member who asks for one anyway, and logs
 * the attempt.
 */
export default function InviteForm({
  actor,
  onInvited,
}: {
  actor: PublicUser
  onInvited?: (user: PublicUser) => void
}) {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState<PublicUser['role']>('member')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const isAdmin = actor.role === 'admin'
  const ownDomain = actor.email.split('@')[1]

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setDone(null)
    setBusy(true)

    const result = await api.post<{ user: PublicUser }>('/api/users/invite', {
      email,
      name,
      ...(isAdmin ? { role } : {}),
    })
    setBusy(false)

    if (!result.ok) {
      setError(result.error)
      return
    }

    setDone(
      `${result.data.user.name} is on the list as ${result.data.user.role === 'admin' ? 'an administrator' : 'a member'}. Nothing has been sent to them yet.`,
    )
    setEmail('')
    setName('')
    setRole('member')
    onInvited?.(result.data.user)
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 max-w-sm">
      <label className="flex flex-col gap-1.5">
        <span className="eyebrow">Their name</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="rulebox px-3 py-2 text-sm"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="eyebrow">Their email</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="rulebox px-3 py-2 text-sm"
        />
        <span className="text-xs text-ink-muted">
          {isAdmin
            ? 'Either polycohealthline.com or ecofibre.bh.'
            : `Colleagues at ${ownDomain}. Ask an administrator for anyone else.`}
        </span>
      </label>

      {isAdmin && (
        <label className="flex flex-col gap-1.5">
          <span className="eyebrow">Role</span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as PublicUser['role'])}
            className="rulebox px-3 py-2 text-sm"
          >
            <option value="member">Member</option>
            <option value="admin">Administrator</option>
          </select>
        </label>
      )}

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
        {busy ? 'Adding them' : 'Add them'}
      </button>
    </form>
  )
}
