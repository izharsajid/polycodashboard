import { INVITATION_TTL_MS, RESET_TTL_MS, STORES } from './config'
import { kv } from './kv'
import { Invitation, type InvitationT, type RoleT, type TokenPurposeT } from './schema'
import { hashToken, newToken } from './tokens'

const invitations = () => kv(STORES.invitations)

/**
 * Invitations and password resets are one record with two lifetimes: 7 days and 1
 * hour, per AUTH-SPEC section 4. They share this code deliberately. Single use is
 * the guarantee both of them live or die by, and two implementations of it would
 * drift apart the first time one was touched.
 */
export type IssueInput = {
  email: string
  role: RoleT
  purpose: TokenPurposeT
  invitedBy?: string | null
}

export type TokenResult =
  | { ok: true; invitation: InvitationT }
  | { ok: false; reason: 'not_found' | 'expired' | 'consumed' }

/** The raw token is returned once, for the link. Only its hash is stored. */
export async function issueToken(
  input: IssueInput,
  now = new Date(),
): Promise<{ token: string; invitation: InvitationT }> {
  const token = newToken()
  const ttl = input.purpose === 'reset' ? RESET_TTL_MS : INVITATION_TTL_MS
  const invitation = Invitation.parse({
    tokenHash: hashToken(token),
    purpose: input.purpose,
    email: input.email,
    invitedBy: input.invitedBy ?? null,
    role: input.role,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + ttl).toISOString(),
    consumedAt: null,
  })
  await invitations().put(invitation.tokenHash, invitation)
  return { token, invitation }
}

/** Look without consuming — the page that asks "who is this invitation for?". */
export async function readToken(
  token: string | null | undefined,
  purpose: TokenPurposeT,
  now = new Date(),
): Promise<TokenResult> {
  if (!token) return { ok: false, reason: 'not_found' }
  return inspect(await invitations().get(hashToken(token)), purpose, now)
}

/**
 * Consume once. The conditional write is what makes that true: if the same link
 * is opened twice at the same moment, one write carries the etag it read and the
 * other does not, so exactly one succeeds.
 */
export async function consumeToken(
  token: string | null | undefined,
  purpose: TokenPurposeT,
  now = new Date(),
): Promise<TokenResult> {
  if (!token) return { ok: false, reason: 'not_found' }

  const key = hashToken(token)
  const hit = await invitations().getWithEtag(key)
  const checked = inspect(hit?.value ?? null, purpose, now)
  if (!checked.ok) return checked

  const consumed: InvitationT = { ...checked.invitation, consumedAt: now.toISOString() }
  if (!(await invitations().replace(key, consumed, hit?.etag ?? ''))) {
    return { ok: false, reason: 'consumed' }
  }
  return { ok: true, invitation: consumed }
}

/**
 * A purpose mismatch reads as not_found rather than as a wrong-kind error. A
 * reset token offered to the invitation endpoint should not confirm that a reset
 * token exists.
 */
function inspect(raw: unknown, purpose: TokenPurposeT, now: Date): TokenResult {
  if (raw === null || raw === undefined) return { ok: false, reason: 'not_found' }

  const parsed = Invitation.safeParse(raw)
  if (!parsed.success) return { ok: false, reason: 'not_found' }

  const invitation = parsed.data
  if (invitation.purpose !== purpose) return { ok: false, reason: 'not_found' }
  if (invitation.consumedAt !== null) return { ok: false, reason: 'consumed' }
  if (now.getTime() >= Date.parse(invitation.expiresAt)) return { ok: false, reason: 'expired' }
  return { ok: true, invitation }
}

/**
 * Every outstanding token for an address, consumed or not. Issuing a new one
 * should kill the old, so that a link someone forwarded last week stops working
 * the moment they ask for another.
 */
export async function revokeTokensFor(
  email: string,
  purpose: TokenPurposeT,
): Promise<number> {
  const wanted = email.trim().toLowerCase()
  let revoked = 0

  for (const key of await invitations().keys()) {
    const raw = await invitations().get(key)
    const parsed = Invitation.safeParse(raw)
    if (!parsed.success) continue
    if (parsed.data.email !== wanted || parsed.data.purpose !== purpose) continue
    await invitations().delete(key)
    revoked++
  }
  return revoked
}
