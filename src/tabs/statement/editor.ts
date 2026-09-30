import { useCallback, useState } from 'react'
import type { EntryT } from '../../engine/statementSchema'

/**
 * The editor session. Reading the statement is open; recording a change needs
 * the passcode set as EDITOR_KEY on Netlify, and a name, which is stamped on
 * every change. Both live in this browser tab only (sessionStorage), and go
 * when the tab closes or the editor locks.
 */
export type Editor = { name: string; key: string }

const STORAGE = 'ef-statement-editor'

function load(): Editor | null {
  try {
    const raw = sessionStorage.getItem(STORAGE)
    return raw ? (JSON.parse(raw) as Editor) : null
  } catch {
    return null
  }
}

async function errorOf(res: Response): Promise<string> {
  const body = (await res.json().catch(() => null)) as { error?: string } | null
  return body?.error ?? `The server answered ${res.status}. Try again.`
}

export function useEditor() {
  const [editor, setEditor] = useState<Editor | null>(load)

  const unlock = useCallback(async (name: string, key: string): Promise<string | null> => {
    const res = await fetch('/api/editor', { method: 'POST', headers: { 'x-editor-key': key } }).catch(() => null)
    if (!res) return 'Could not reach the server. Check your connection.'
    if (!res.ok) return errorOf(res)
    const next = { name: name.trim(), key }
    try {
      sessionStorage.setItem(STORAGE, JSON.stringify(next))
    } catch {
      // Private browsing: the session simply ends with the page.
    }
    setEditor(next)
    return null
  }, [])

  const lock = useCallback(() => {
    try {
      sessionStorage.removeItem(STORAGE)
    } catch {
      // Nothing stored to remove.
    }
    setEditor(null)
  }, [])

  return { editor, unlock, lock }
}

export type NewEntry = Omit<EntryT, 'id' | 'at' | 'voided' | 'by' | 'key' | 'value'> & {
  key?: string | null
  value?: string | null
}

export async function recordEntry(editor: Editor, entry: NewEntry): Promise<{ ok: true; entry: EntryT } | { ok: false; error: string }> {
  const res = await fetch('/api/statement/entries', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-editor-key': editor.key },
    body: JSON.stringify({ action: 'create', entry: { key: null, value: null, ...entry, by: editor.name } }),
  }).catch(() => null)
  if (!res) return { ok: false, error: 'Could not reach the server. Nothing was recorded.' }
  if (!res.ok) return { ok: false, error: await errorOf(res) }
  return { ok: true, entry: ((await res.json()) as { entry: EntryT }).entry }
}

export async function voidEntry(editor: Editor, id: string, reason: string): Promise<string | null> {
  const res = await fetch('/api/statement/entries', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-editor-key': editor.key },
    body: JSON.stringify({ action: 'void', id, by: editor.name, reason }),
  }).catch(() => null)
  if (!res) return 'Could not reach the server. Nothing was changed.'
  return res.ok ? null : errorOf(res)
}

export async function uploadFile(editor: Editor, target: string, file: File): Promise<string | null> {
  const form = new FormData()
  form.set('file', file)
  form.set('by', editor.name)
  const res = await fetch(`/api/statement/files?target=${encodeURIComponent(target)}`, {
    method: 'POST',
    headers: { 'x-editor-key': editor.key },
    body: form,
  }).catch(() => null)
  if (!res) return 'Could not reach the server. The file was not uploaded.'
  return res.ok ? null : errorOf(res)
}

export const fileUrl = (id: string, action: 'view' | 'download') =>
  `/api/statement/files?${new URLSearchParams({ id, action })}`
