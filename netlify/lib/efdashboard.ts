/**
 * Reading efdashboard.com, the master for orders, dispatches and PO files.
 *
 * The PO rows and settings come from its Supabase project, read with the same
 * public key its own page uses, held here as SUPABASE_URL and SUPABASE_ANON_KEY
 * in the Netlify environment and never sent to the browser. The file list and
 * the files themselves come from efdashboard.com's own /api/po-documents.
 *
 * Read only. This site never writes to efdashboard.com. POs listed in
 * data/removed-pos.json are dropped here, before anything reaches the browser.
 */
import removed from '../../data/removed-pos.json' with { type: 'json' }

export const EFDASHBOARD = 'https://efdashboard.com'

export class MasterUnavailable extends Error {}

async function getJson(url: string, headers: Record<string, string> = {}): Promise<unknown> {
  const res = await fetch(url, { headers, cache: 'no-store' })
  if (!res.ok) throw new MasterUnavailable(`${new URL(url).host} answered ${res.status}`)
  return res.json()
}

let cached: { at: number; payload: unknown } | null = null
const FRESH_MS = 30_000

/** The tracker payload, at most thirty seconds old. */
export async function readTracker(): Promise<unknown> {
  if (cached && Date.now() - cached.at < FRESH_MS) return cached.payload

  const base = process.env.SUPABASE_URL?.replace(/\/+$/, '')
  const key = process.env.SUPABASE_ANON_KEY
  if (!base || !key) throw new MasterUnavailable('SUPABASE_URL and SUPABASE_ANON_KEY are not set in the Netlify environment.')
  const auth = { apikey: key, Authorization: `Bearer ${key}` }

  const [rows, settings, docs] = await Promise.all([
    getJson(`${base}/rest/v1/po_data?select=*&order=sort_order.asc`, auth),
    getJson(`${base}/rest/v1/settings?select=*`, auth),
    getJson(`${EFDASHBOARD}/api/po-documents`),
  ])
  const documents = ((docs as { documents?: Record<string, unknown>[] }).documents ?? []).map((d) => ({
    po: d.po, name: d.name, title: d.title, note: d.note, size: d.size, updated_at: d.updated_at,
  }))

  const payload = withoutRemoved(
    { rows: rows as { po_number?: unknown }[], settings, documents, fetched_at: new Date().toISOString() },
    removed.pos,
  )
  cached = { at: Date.now(), payload }
  return payload
}

/** A PO number, or one of its numbered lots, from the given list. */
const isRemoved = (po: unknown, list: string[]) => {
  const v = String(po ?? '').trim()
  return list.some((id) => v === id || new RegExp(`^${id}-\\d+$`).test(v))
}

/** The feed without any row or file for a PO removed from the dashboard. */
export function withoutRemoved<T extends { rows: { po_number?: unknown }[]; documents: { po?: unknown }[] }>(feed: T, list: string[]): T {
  return {
    ...feed,
    rows: feed.rows.filter((r) => !isRemoved(r.po_number, list)),
    documents: feed.documents.filter((d) => !isRemoved(d.po, list)),
  }
}
