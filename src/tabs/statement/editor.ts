import { useSession } from '../../auth/session'
import type { EntryT } from '../../engine/statementSchema'

/**
 * Who is editing: whoever is signed in. The server stamps every change with the
 * signed-in account's name, so the page never sends one. Signed out, the
 * statement is read only.
 */
export type Editor = { name: string }

export function useEditor(): { editor: Editor | null } {
  const session = useSession()
  return { editor: session.status === 'in' ? { name: session.user.name } : null }
}

async function errorOf(res: Response): Promise<string> {
  if (res.status === 401) return 'Your session has ended. Sign in again to make changes.'
  const body = (await res.json().catch(() => null)) as { error?: string } | null
  return body?.error ?? `The server answered ${res.status}. Try again.`
}

export type NewEntry = Omit<EntryT, 'id' | 'at' | 'voided' | 'by' | 'key' | 'value'> & {
  key?: string | null
  value?: string | null
}

export async function recordEntry(_editor: Editor, entry: NewEntry): Promise<{ ok: true; entry: EntryT } | { ok: false; error: string }> {
  const res = await fetch('/api/statement/entries', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'create', entry: { key: null, value: null, ...entry } }),
  }).catch(() => null)
  if (!res) return { ok: false, error: 'Could not reach the server. Nothing was recorded.' }
  if (!res.ok) return { ok: false, error: await errorOf(res) }
  return { ok: true, entry: ((await res.json()) as { entry: EntryT }).entry }
}

export async function voidEntry(_editor: Editor, id: string, reason: string): Promise<string | null> {
  const res = await fetch('/api/statement/entries', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'void', id, reason }),
  }).catch(() => null)
  if (!res) return 'Could not reach the server. Nothing was changed.'
  return res.ok ? null : errorOf(res)
}

export async function uploadFile(_editor: Editor, target: string, file: File): Promise<string | null> {
  const form = new FormData()
  form.set('file', file)
  const res = await fetch(`/api/statement/files?target=${encodeURIComponent(target)}`, {
    method: 'POST',
    credentials: 'same-origin',
    body: form,
  }).catch(() => null)
  if (!res) return 'Could not reach the server. The file was not uploaded.'
  return res.ok ? null : errorOf(res)
}

export const fileUrl = (id: string, action: 'view' | 'download') =>
  `/api/statement/files?${new URLSearchParams({ id, action })}`
