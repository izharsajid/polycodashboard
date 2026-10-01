import { useState, type FormEvent } from 'react'
import type { PublicUser } from '../../netlify/lib/http'
import { api } from '../lib/api'
import { whenLocal } from '../lib/format'

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
  const [link, setLink] = useState<{ url: string; expiresAt: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)

  const isAdmin = actor.role === 'admin'
  const ownDomain = actor.email.split('@')[1]

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setDone(null)
    setLink(null)
    setCopied(false)
    setBusy(true)

    const result = await api.post<{ user: PublicUser; link: string | null; emailed?: boolean; expiresAt: string }>('/api/users/invite', {
      email,
      name,
      ...(isAdmin ? { role } : {}),
    })
    setBusy(false)

    if (!result.ok) {
      setError(result.error)
      return
    }

    const who = result.data.user
    setDone(
      `${who.name} is added as ${who.role === 'admin' ? 'an administrator' : 'a member'}. ` +
        (result.data.emailed
          ? 'They have been emailed a link to choose their password, and you can also send them the one below.'
          : 'Send them the link below; they open it to choose their own password.'),
    )
    if (result.data.link) setLink({ url: result.data.link, expiresAt: result.data.expiresAt })
    setEmail('')
    setName('')
    setRole('member')
    onInvited?.(result.data.user)
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 max-w-sm">
      <label className="flex flex-col gap-1">
        <span className="kicker">Their name</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="field w-full"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="kicker">Their email</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="field w-full"
        />
        <span className="text-table text-press-2">
          {isAdmin
            ? 'Either polycohealthline.com or ecofibre.bh.'
            : `Colleagues at ${ownDomain}. Ask an administrator for anyone else.`}
        </span>
      </label>

      {isAdmin && (
        <label className="flex flex-col gap-1">
          <span className="kicker">Role</span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as PublicUser['role'])}
            className="field w-full"
          >
            <option value="member">Member</option>
            <option value="admin">Administrator</option>
          </select>
        </label>
      )}

      {error && (
        <p role="alert" className="border-l-2 border-alert pl-2 py-1 text-body text-press">
          {error}
        </p>
      )}
      {done && (
        <p role="status" className="border-l-2 border-press pl-2 py-1 text-body text-press">
          {done}
        </p>
      )}
      {link && (
        <div className="rounded-card bg-mist p-3">
          <p className="kicker">Their one-time link</p>
          <p className="mt-1 break-all text-small">{link.url}</p>
          <p className="mt-1 text-small text-press-2">
            Works once, until {whenLocal(link.expiresAt)}. It is shown only now; add them again for a new one.
          </p>
          <button
            type="button"
            className="btn-secondary mt-2"
            onClick={() =>
              void navigator.clipboard
                .writeText(link.url)
                .then(() => setCopied(true))
                .catch(() => setCopied(false))
            }
          >
            {copied ? 'Copied' : 'Copy link'}
          </button>
        </div>
      )}

      <button
        type="submit"
        disabled={busy}
        className="btn-primary mt-1 w-full disabled:opacity-50"
      >
        {busy ? 'Adding them' : 'Add them'}
      </button>
    </form>
  )
}
