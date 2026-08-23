import { useCallback, useEffect, useState } from 'react'
import type { PublicUser } from '../../netlify/lib/http'
import AuditLog from '../components/AuditLog'
import Header from '../components/Header'
import InviteForm from '../components/InviteForm'
import { api } from '../lib/api'
import { whenLocal } from '../lib/format'
import { navigate } from '../lib/navigation'
import { DASHBOARD } from '../lib/router'

const STATUS_LABEL: Record<PublicUser['status'], string> = {
  invited: 'Invited, not yet signed in',
  active: 'Active',
  deactivated: 'Deactivated',
}

/**
 * Administrators only. The route is hidden from everyone else and every endpoint
 * behind it checks the role again on the server, because hiding a link is not
 * access control.
 *
 */
export default function Admin({ user }: { user: PublicUser }) {
  const [users, setUsers] = useState<PublicUser[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [working, setWorking] = useState<string | null>(null)

  const load = useCallback(async () => {
    const result = await api.get<{ users: PublicUser[] }>('/api/users')
    if (result.ok) setUsers(result.data.users)
    else setError(result.error)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function change(target: PublicUser, body: Record<string, unknown>) {
    setError(null)
    setWorking(target.id)

    const result = await api.patch<{ user: PublicUser }>(`/api/users/${target.id}`, body)
    setWorking(null)

    if (!result.ok) {
      setError(result.error)
      return
    }
    setUsers((current) =>
      (current ?? []).map((u) => (u.id === result.data.user.id ? result.data.user : u)),
    )
  }

  return (
    <div className="min-h-screen">
      <Header user={user} />

      <main className="mx-auto max-w-5xl px-3 py-6">
        <header className="mb-4 border-b border-rule pb-2">
          <h1 className="text-title font-semibold tracking-tight">People and access</h1>
          <p className="mt-1 max-w-2xl text-body text-ink-muted leading-relaxed">
            Everyone here sees the same figures. The only thing role changes is who can
            edit data, change roles and read the audit log.
          </p>
        </header>

        {error && (
          <p role="alert" className="border-l-2 border-critical pl-2 py-1 text-body text-ink mb-3">
            {error}
          </p>
        )}

        {users === null ? (
          <p className="text-body text-ink-muted" aria-busy="true">
            Loading the list.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-body border-collapse">
              <thead>
                <tr className="border-b border-rule text-left">
                  <th className="th">Name</th>
                  <th className="th">Email</th>
                  <th className="th">Role</th>
                  <th className="th">Status</th>
                  <th className="th">Last signed in</th>
                  <th className="th">Access</th>
                </tr>
              </thead>
              <tbody>
                {users.map((row) => {
                  const self = row.id === user.id
                  const busy = working === row.id
                  return (
                    <tr key={row.id} className="border-b border-rule align-middle">
                      <td className="py-2 pr-2">{row.name}</td>
                      <td className="py-2 pr-2 text-ink-muted">{row.email}</td>
                      <td className="py-2 pr-2">
                        <select
                          value={row.role}
                          disabled={self || busy}
                          title={self ? 'You cannot change your own role.' : undefined}
                          onChange={(e) => void change(row, { role: e.target.value })}
                          className="field disabled:opacity-50"
                        >
                          <option value="member">Member</option>
                          <option value="admin">Administrator</option>
                        </select>
                      </td>
                      <td className="py-2 pr-2 text-ink-muted">{STATUS_LABEL[row.status]}</td>
                      <td className="py-2 pr-2 num text-table text-ink-muted">
                        {whenLocal(row.lastLoginAt)}
                      </td>
                      <td className="py-2">
                        <button
                          type="button"
                          disabled={self || busy}
                          title={self ? 'You cannot deactivate your own account.' : undefined}
                          onClick={() =>
                            void change(row, { deactivated: row.status !== 'deactivated' })
                          }
                          className="text-body underline underline-offset-2 text-ink-muted hover:text-ink disabled:opacity-40 disabled:no-underline"
                        >
                          {row.status === 'deactivated' ? 'Reactivate' : 'Deactivate'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <section className="mt-8 border-t border-rule pt-4">
          <h2 className="text-figure font-semibold tracking-tight mb-1">Add someone</h2>
          <p className="text-body text-ink-muted leading-relaxed mb-3 max-w-2xl">
            They go on the list straight away and choose their own password from a link
            that works once. Nothing is sent while sending is switched off, so adding
            someone now tells them nothing.
          </p>
          <InviteForm actor={user} onInvited={() => void load()} />
        </section>

        <section className="mt-8 border-t border-rule pt-4">
          <AuditLog users={users ?? []} />
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
