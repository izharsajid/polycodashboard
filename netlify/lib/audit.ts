import { STORES } from './config'
import { kv } from './kv'
import { AuditEntry, type AuditActionT, type AuditEntryT } from './schema'
import { newId } from './tokens'

const audit = () => kv(STORES.audit)

/**
 * The audit log. AUTH-SPEC section 7: append only, no delete endpoint, and there
 * will not be one. This module exports a writer and a reader and nothing else,
 * which is the cheapest way to keep that true — you cannot call what does not
 * exist.
 *
 * The key is timestamp first so that a lexicographic listing is a chronological
 * one, and carries a random id after it so two events in the same millisecond
 * cannot overwrite each other.
 *
 * Never pass a password, a session token or an invitation token in detail. Log
 * the fact, not the secret.
 */
export type NewAuditEntry = {
  action: AuditActionT
  result: 'success' | 'failure'
  actorId?: string | null
  actorEmail?: string | null
  target?: string | null
  detail?: string | null
  ip?: string | null
}

export async function record(entry: NewAuditEntry, now = new Date()): Promise<AuditEntryT> {
  const parsed = AuditEntry.parse({
    id: newId(),
    timestamp: now.toISOString(),
    actorId: entry.actorId ?? null,
    actorEmail: entry.actorEmail ? entry.actorEmail.trim().toLowerCase() : null,
    action: entry.action,
    target: entry.target ?? null,
    detail: entry.detail ?? null,
    ip: entry.ip ?? null,
    result: entry.result,
  })

  // create, not put: an entry is written once and never revised.
  await audit().create(auditKey(parsed), parsed)
  return parsed
}

export function auditKey(entry: AuditEntryT): string {
  return `${entry.timestamp}:${entry.id}`
}

export type AuditQuery = {
  /** ISO timestamps. from is inclusive, to is exclusive. */
  from?: string
  to?: string
  action?: AuditActionT
  actorId?: string
  limit?: number
  /** The nextCursor from a previous page. Returns entries strictly older. */
  cursor?: string
}

export type AuditPage = {
  entries: AuditEntryT[]
  /** Null when that was the last page. */
  nextCursor: string | null
}

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200

/**
 * Newest first, a page at a time.
 *
 * The cursor is a key rather than an offset. Keys are timestamp first, so paging
 * by key is stable even though entries are being appended while somebody reads:
 * new arrivals sort above the cursor and never shuffle the page in front of them.
 */
export async function pageAudit(query: AuditQuery = {}): Promise<AuditPage> {
  const limit = Math.min(Math.max(query.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT)
  const keys = (await audit().keys()).sort().reverse()
  const entries: AuditEntryT[] = []

  let last: string | null = null
  let more = false

  for (const key of keys) {
    if (query.cursor && key >= query.cursor) continue

    const parsed = AuditEntry.safeParse(await audit().get(key))
    if (!parsed.success) continue

    const entry = parsed.data
    if (query.from && entry.timestamp < query.from) continue
    if (query.to && entry.timestamp >= query.to) continue
    if (query.action && entry.action !== query.action) continue
    if (query.actorId && entry.actorId !== query.actorId) continue

    // One past the limit, purely to learn whether there is another page.
    if (entries.length === limit) {
      more = true
      break
    }
    entries.push(entry)
    last = key
  }

  return { entries, nextCursor: more ? last : null }
}

/** The whole page, for callers that do not care about paging. */
export async function listAudit(query: AuditQuery = {}): Promise<AuditEntryT[]> {
  return (await pageAudit(query)).entries
}
