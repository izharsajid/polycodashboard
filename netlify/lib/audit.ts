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
}

/**
 * Newest first. Filtering and paging in the admin view come at gate 7; this is
 * the read the tests and the seed checks need, and enough to answer "what
 * happened just now" from a script.
 */
export async function listAudit(query: AuditQuery = {}): Promise<AuditEntryT[]> {
  const keys = (await audit().keys()).sort().reverse()
  const out: AuditEntryT[] = []
  const limit = query.limit ?? 100

  for (const key of keys) {
    if (out.length >= limit) break
    const parsed = AuditEntry.safeParse(await audit().get(key))
    if (!parsed.success) continue

    const entry = parsed.data
    if (query.from && entry.timestamp < query.from) continue
    if (query.to && entry.timestamp >= query.to) continue
    if (query.action && entry.action !== query.action) continue
    if (query.actorId && entry.actorId !== query.actorId) continue
    out.push(entry)
  }
  return out
}
