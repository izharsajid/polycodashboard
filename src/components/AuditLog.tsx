import { useCallback, useEffect, useState } from 'react'
import type { AuditActionT, AuditEntryT } from '../../netlify/lib/schema'
import type { PublicUser } from '../../netlify/lib/http'
import { api } from '../lib/api'
import { whenLocal } from '../lib/format'

/**
 * Not because anyone is distrusted. Because in six months somebody will ask when
 * a figure changed and who changed it, and the answer needs to exist.
 *
 * Read only, and there is nothing here that could write or remove an entry.
 */
const ACTION_LABEL: Record<AuditActionT, string> = {
  sign_in: 'Signed in',
  sign_out: 'Signed out',
  sign_in_failed: 'Sign-in failed',
  account_locked: 'Account locked',
  account_unlocked: 'Account unlocked',
  password_changed: 'Password changed',
  password_reset_requested: 'Reset requested',
  password_reset_completed: 'Reset completed',
  invitation_sent: 'Invitation created',
  invitation_accepted: 'Invitation accepted',
  invitation_refused_domain: 'Invitation refused',
  role_changed: 'Role changed',
  user_deactivated: 'Deactivated',
  user_reactivated: 'Reactivated',
  user_created: 'Account created',
  access_refused: 'Access refused',
  document_uploaded: 'Document uploaded',
  document_viewed: 'Document viewed',
  document_downloaded: 'Document downloaded',
  document_deleted: 'Document deleted',
  data_edited: 'Data edited',
  export_downloaded: 'Exported',
  rate_limit_exceeded: 'Rate limit hit',
}

const ACTIONS = Object.keys(ACTION_LABEL) as AuditActionT[]

type Filters = { action: string; actorId: string; from: string; to: string }

const EMPTY: Filters = { action: '', actorId: '', from: '', to: '' }

/** A date input gives yyyy-mm-dd. The API wants an instant. */
function asInstant(day: string, endOfDay: boolean): string | null {
  if (!day) return null
  const at = new Date(`${day}T00:00:00.000Z`)
  if (Number.isNaN(at.getTime())) return null
  if (endOfDay) at.setUTCDate(at.getUTCDate() + 1)
  return at.toISOString()
}

export default function AuditLog({ users }: { users: PublicUser[] }) {
  const [filters, setFilters] = useState<Filters>(EMPTY)
  const [entries, setEntries] = useState<AuditEntryT[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const fetchPage = useCallback(
    async (active: Filters, after: string | null) => {
      const query = new URLSearchParams()
      if (active.action) query.set('action', active.action)
      if (active.actorId) query.set('actorId', active.actorId)

      const from = asInstant(active.from, false)
      const to = asInstant(active.to, true)
      if (from) query.set('from', from)
      if (to) query.set('to', to)
      if (after) query.set('cursor', after)

      setBusy(true)
      setError(null)
      const result = await api.get<{ entries: AuditEntryT[]; nextCursor: string | null }>(
        `/api/audit?${query.toString()}`,
      )
      setBusy(false)

      if (!result.ok) {
        setError(result.error)
        return
      }
      setEntries((current) => (after ? [...current, ...result.data.entries] : result.data.entries))
      setCursor(result.data.nextCursor)
    },
    [],
  )

  useEffect(() => {
    void fetchPage(filters, null)
  }, [fetchPage, filters])

  const nameFor = (entry: AuditEntryT) =>
    users.find((u) => u.id === entry.actorId)?.name ?? entry.actorEmail ?? 'Not signed in'

  return (
    <section>
      <h2 className="text-figure font-semibold tracking-tight mb-1">Audit log</h2>
      <p className="text-body text-ink-muted leading-relaxed mb-3 max-w-2xl">
        Every sign-in, invitation, role change and password change, kept as it happened.
        Entries are added and never altered or removed.
      </p>

      <div className="flex flex-wrap gap-2 mb-3">
        <label className="flex flex-col gap-1">
          <span className="kicker">Person</span>
          <select
            value={filters.actorId}
            onChange={(e) => setFilters({ ...filters, actorId: e.target.value })}
            className="field"
          >
            <option value="">Anyone</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="kicker">What happened</span>
          <select
            value={filters.action}
            onChange={(e) => setFilters({ ...filters, action: e.target.value })}
            className="field"
          >
            <option value="">Anything</option>
            {ACTIONS.map((a) => (
              <option key={a} value={a}>
                {ACTION_LABEL[a]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="kicker">From</span>
          <input
            type="date"
            value={filters.from}
            onChange={(e) => setFilters({ ...filters, from: e.target.value })}
            className="field"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="kicker">To</span>
          <input
            type="date"
            value={filters.to}
            onChange={(e) => setFilters({ ...filters, to: e.target.value })}
            className="field"
          />
        </label>

        <button
          type="button"
          onClick={() => setFilters(EMPTY)}
          className="self-end text-body text-ink-muted underline underline-offset-2 hover:text-ink pb-1"
        >
          Clear
        </button>
      </div>

      {error && (
        <p role="alert" className="border-l-2 border-critical pl-2 py-1 text-body text-ink mb-2">
          {error}
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-body border-collapse">
          <thead>
            <tr className="border-b border-rule text-left">
              <th className="th">When</th>
              <th className="th">Who</th>
              <th className="th">What</th>
              <th className="th">On</th>
              <th className="th">Detail</th>
              <th className="th">From</th>
              <th className="th">Outcome</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id} className="border-b border-rule align-top">
                <td className="py-1 pr-2 num text-table whitespace-nowrap">
                  {whenLocal(entry.timestamp)}
                </td>
                <td className="py-1 pr-2">{nameFor(entry)}</td>
                <td className="py-1 pr-2">{ACTION_LABEL[entry.action]}</td>
                <td className="py-1 pr-2 text-ink-muted">{entry.target ?? ''}</td>
                <td className="py-1 pr-2 text-ink-muted">{entry.detail ?? ''}</td>
                <td className="py-1 pr-2 num text-table text-ink-muted">{entry.ip ?? ''}</td>
                <td className={`py-1 ${entry.result === 'failure' ? 'text-critical' : 'text-ink-muted'}`}>
                  {entry.result === 'failure' ? 'Refused' : 'Done'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {entries.length === 0 && !busy && (
        <p className="text-body text-ink-muted py-2">Nothing matches that.</p>
      )}

      {cursor && (
        <button
          type="button"
          disabled={busy}
          onClick={() => void fetchPage(filters, cursor)}
          className="mt-2 text-body text-ink-muted underline underline-offset-2 hover:text-ink disabled:opacity-50"
        >
          {busy ? 'Loading' : 'Show older'}
        </button>
      )}
    </section>
  )
}
