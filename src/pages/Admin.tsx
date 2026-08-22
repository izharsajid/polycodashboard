import { useCallback, useEffect, useState } from 'react'
import type { PublicUser } from '../../netlify/lib/http'
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
 * The audit log joins this page at gate 7.
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

      <main className="mx-auto max-w-5xl px-6 py-10">
        <header className="mb-8 border-b border-rule pb-4">
          <h1 className="text-xl font-semibold tracking-tight">People and access</h1>
          <p className="mt-2 max-w-2xl text-sm text-ink-muted leading-relaxed">
            Everyone here sees the same figures. The only thing role changes is who can
            edit data, change roles and read the audit log.
          </p>
        </header>

        {error && (
          <p role="alert" className="border-l-2 border-alert pl-3 py-1 text-sm text-ink mb-6">
            {error}
          </p>
        )}

        {users === null ? (
          <p className="text-sm text-ink-muted" aria-busy="true">
            Loading the list.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-rule-strong text-left">
                  <th className="eyebrow py-2 pr-4 font-semibold">Name</th>
                  <th className="eyebrow py-2 pr-4 font-semibold">Email</th>
                  <th className="eyebrow py-2 pr-4 font-semibold">Role</th>
                  <th className="eyebrow py-2 pr-4 font-semibold">Status</th>
                  <th className="eyebrow py-2 pr-4 font-semibold">Last signed in</th>
                  <th className="eyebrow py-2 font-semibold">Access</th>
                </tr>
              </thead>
              <tbody>
                {users.map((row) => {
                  const self = row.id === user.id
                  const busy = working === row.id
                  return (
                    <tr key={row.id} className="border-b border-rule align-middle">
                      <td className="py-2.5 pr-4">{row.name}</td>
                      <td className="py-2.5 pr-4 text-ink-muted">{row.email}</td>
                      <td className="py-2.5 pr-4">
                        <select
                          value={row.role}
                          disabled={self || busy}
                          title={self ? 'You cannot change your own role.' : undefined}
                          onChange={(e) => void change(row, { role: e.target.value })}
                          className="rulebox px-2 py-1 text-sm disabled:opacity-50"
                        >
                          <option value="member">Member</option>
                          <option value="admin">Administrator</option>
                        </select>
                      </td>
                      <td className="py-2.5 pr-4 text-ink-muted">{STATUS_LABEL[row.status]}</td>
                      <td className="py-2.5 pr-4 num text-[12px] text-ink-muted">
                        {whenLocal(row.lastLoginAt)}
                      </td>
                      <td className="py-2.5">
                        <button
                          type="button"
                          disabled={self || busy}
                          title={self ? 'You cannot deactivate your own account.' : undefined}
                          onClick={() =>
                            void change(row, { deactivated: row.status !== 'deactivated' })
                          }
                          className="text-sm underline underline-offset-2 text-ink-muted hover:text-ink disabled:opacity-40 disabled:no-underline"
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

        <section className="mt-14 border-t border-rule pt-8">
          <h2 className="text-base font-semibold tracking-tight mb-1">Add someone</h2>
          <p className="text-sm text-ink-muted leading-relaxed mb-6 max-w-2xl">
            They go on the list straight away and choose their own password from a link
            that works once. Nothing is sent while sending is switched off, so adding
            someone now tells them nothing.
          </p>
          <InviteForm actor={user} onInvited={() => void load()} />
        </section>

        <button
          type="button"
          onClick={() => navigate(DASHBOARD)}
          className="mt-12 text-sm text-ink-muted underline underline-offset-2 hover:text-ink"
        >
          Back to the dashboard
        </button>
      </main>
    </div>
  )
}
