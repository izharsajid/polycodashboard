import {
  SESSION_ABSOLUTE_MS,
  SESSION_COOKIE,
  SESSION_IDLE_MS,
  STORES,
} from './config'
import { kv } from './kv'
import { Session, type SessionT } from './schema'
import { hashToken, newToken } from './tokens'

const sessions = () => kv(STORES.sessions)

/** Only move lastSeenAt when it is stale enough to be worth a write. */
const TOUCH_INTERVAL_MS = 60 * 1000

export type SessionInput = {
  userId: string
  ip?: string | null
  userAgent?: string | null
}

/**
 * Returns the raw token once, for the cookie. It is not recoverable afterwards —
 * only its hash is stored.
 */
export async function createSession(
  input: SessionInput,
  now = new Date(),
): Promise<{ token: string; session: SessionT }> {
  const token = newToken()
  const session = Session.parse({
    idHash: hashToken(token),
    userId: input.userId,
    createdAt: now.toISOString(),
    lastSeenAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + SESSION_ABSOLUTE_MS).toISOString(),
    ip: input.ip ?? null,
    userAgent: input.userAgent?.slice(0, 400) ?? null,
  })
  await sessions().put(session.idHash, session)
  return { token, session }
}

/**
 * The one place a cookie becomes a session. Enforces both limits from AUTH-SPEC
 * section 6 — 12 hours idle, 7 days absolute — and deletes anything past either,
 * so an expired session does not sit in the store waiting to be mishandled.
 *
 * Returns null for every failure, without distinguishing them. A caller that
 * cannot tell "no cookie" from "expired cookie" cannot leak the difference.
 */
export async function resolveSession(
  token: string | null | undefined,
  now = new Date(),
): Promise<SessionT | null> {
  if (!token) return null

  const idHash = hashToken(token)
  const raw = await sessions().get(idHash)
  if (!raw) return null

  const parsed = Session.safeParse(raw)
  if (!parsed.success) {
    await sessions().delete(idHash)
    return null
  }
  const session = parsed.data

  const at = now.getTime()
  const idleDeadline = Date.parse(session.lastSeenAt) + SESSION_IDLE_MS
  if (at >= Date.parse(session.expiresAt) || at >= idleDeadline) {
    await sessions().delete(idHash)
    return null
  }

  if (at - Date.parse(session.lastSeenAt) >= TOUCH_INTERVAL_MS) {
    const touched = { ...session, lastSeenAt: now.toISOString() }
    await sessions().put(idHash, touched)
    return touched
  }
  return session
}

export async function destroySession(token: string | null | undefined): Promise<void> {
  if (!token) return
  await sessions().delete(hashToken(token))
}

/**
 * AUTH-SPEC section 6: changing a password invalidates every other session for
 * that user. Pass the current token to keep the person who just changed it signed
 * in; pass nothing to sign them out everywhere, which is what a reset or a
 * deactivation wants.
 *
 * Scans the store. Same reasoning as getUserByEmail: at this size an index would
 * be another thing to keep true.
 */
export async function revokeUserSessions(
  userId: string,
  keepToken?: string | null,
): Promise<number> {
  const keep = keepToken ? hashToken(keepToken) : null
  let revoked = 0

  for (const key of await sessions().keys()) {
    if (key === keep) continue
    const raw = await sessions().get(key)
    if (!raw) continue
    const parsed = Session.safeParse(raw)
    if (!parsed.success || parsed.data.userId !== userId) continue
    await sessions().delete(key)
    revoked++
  }
  return revoked
}

/**
 * HttpOnly so script cannot read it, Secure so it never crosses plain http,
 * SameSite=Strict so it is not attached to a request another site started. Max-Age
 * matches the absolute limit; the idle limit is enforced in resolveSession, where
 * it cannot be edited by whoever holds the cookie.
 */
const ATTRIBUTES = 'Path=/; HttpOnly; Secure; SameSite=Strict'

export function sessionCookie(token: string): string {
  const maxAge = Math.floor(SESSION_ABSOLUTE_MS / 1000)
  return `${SESSION_COOKIE}=${token}; Max-Age=${maxAge}; ${ATTRIBUTES}`
}

export function clearedSessionCookie(): string {
  return `${SESSION_COOKIE}=; Max-Age=0; ${ATTRIBUTES}`
}

export function readSessionCookie(header: string | null | undefined): string | null {
  if (!header) return null
  for (const part of header.split(';')) {
    const at = part.indexOf('=')
    if (at === -1) continue
    if (part.slice(0, at).trim() !== SESSION_COOKIE) continue
    const value = part.slice(at + 1).trim()
    return value.length > 0 ? value : null
  }
  return null
}
