import { z } from 'zod'
import { PASSWORD_MAX_LENGTH } from './config'

/**
 * Every record that enters or leaves the datastore is parsed through one of these,
 * the same way /data is. A blob is untyped bytes until Zod says otherwise.
 */

/**
 * Lowercased and trimmed on the way in, always. AUTH-SPEC section 6: two casings
 * of one address is two accounts and one very confused person.
 */
export const Email = z.string().trim().toLowerCase().email().max(254)

export const Role = z.enum(['admin', 'member'])
export const UserStatus = z.enum(['invited', 'active', 'deactivated'])

/** ISO 8601, UTC, as produced by Date.prototype.toISOString. */
export const Timestamp = z.string().datetime()

/** A SHA-256 of a token, hex. The token itself is never stored. See tokens.ts. */
export const Sha256 = z.string().regex(/^[0-9a-f]{64}$/, 'expected a SHA-256 hex digest')

/** Shape only. Strength is checkPassword() in password.ts. */
export const PasswordInput = z.string().min(1).max(PASSWORD_MAX_LENGTH)

export const User = z
  .object({
    id: z.string().min(1),
    email: Email,
    name: z.string().trim().min(1).max(120),
    role: Role,
    /** Null until the invitation is accepted. No password is ever set for them. */
    passwordHash: z.string().min(1).nullable(),
    status: UserStatus,
    createdAt: Timestamp,
    /** The inviting user's id. Null for the first administrator, who invited nobody. */
    createdBy: z.string().nullable(),
    lastLoginAt: Timestamp.nullable(),
    failedAttempts: z.number().int().min(0),
    lockedUntil: Timestamp.nullable(),
  })
  .refine((u) => u.status !== 'active' || u.passwordHash !== null, {
    message: 'an active user must have a password hash',
    path: ['passwordHash'],
  })

/**
 * Invitations and password resets are the same object with different lifetimes.
 * They share one record and one code path deliberately: the single-use guarantee
 * is the whole point of both, and two implementations of it would drift.
 */
export const TokenPurpose = z.enum(['invitation', 'reset'])

export const Invitation = z.object({
  /** The key this record is stored under. The raw token exists only in the link. */
  tokenHash: Sha256,
  purpose: TokenPurpose,
  email: Email,
  invitedBy: z.string().nullable(),
  role: Role,
  createdAt: Timestamp,
  expiresAt: Timestamp,
  consumedAt: Timestamp.nullable(),
})

export const Session = z.object({
  /** SHA-256 of the cookie value. Stealing the datastore does not yield a session. */
  idHash: Sha256,
  userId: z.string().min(1),
  createdAt: Timestamp,
  /** Moves forward on use. Drives the 12 hour idle expiry. */
  lastSeenAt: Timestamp,
  /** Fixed at creation. Drives the 7 day absolute expiry, whatever the activity. */
  expiresAt: Timestamp,
  ip: z.string().max(64).nullable(),
  userAgent: z.string().max(400).nullable(),
})

/** AUTH-SPEC section 7. Every one of these is logged, success or failure. */
export const AuditAction = z.enum([
  'sign_in',
  'sign_out',
  'sign_in_failed',
  'account_locked',
  'account_unlocked',
  'password_changed',
  'password_reset_requested',
  'password_reset_completed',
  'invitation_sent',
  'invitation_accepted',
  'invitation_refused_domain',
  // Beyond section 7's list. An account created without an invitation, which is
  // how the seeded accounts arrive, is neither an invitation sent nor one
  // accepted, and an account appearing with no entry at all is the thing the
  // audit log exists to prevent.
  'user_created',
  // Also beyond the list, and required by section 9: an unauthenticated request
  // to a protected route, and a member reaching for an administrator endpoint,
  // both have to appear in the log and neither is any of the actions above.
  'access_refused',
  // Documents against an order. PO-TRACKER-SPEC section 4 asks for each of these
  // to be attributed and logged; section 7 of AUTH-SPEC already wanted downloads.
  'document_uploaded',
  'document_viewed',
  'document_downloaded',
  'document_deleted',
  'role_changed',
  'user_deactivated',
  'user_reactivated',
  'data_edited',
  'export_downloaded',
  'rate_limit_exceeded',
])

export const AuditEntry = z.object({
  id: z.string().min(1),
  timestamp: Timestamp,
  actorId: z.string().nullable(),
  /**
   * Not Email: a failed sign-in records the address that was typed, which may not
   * be a valid address at all. The log should not refuse to write because someone
   * mistyped their own name.
   */
  actorEmail: z.string().max(254).nullable(),
  action: AuditAction,
  target: z.string().max(254).nullable(),
  detail: z.string().max(1000).nullable(),
  ip: z.string().max(64).nullable(),
  result: z.enum(['success', 'failure']),
})

export type RoleT = z.infer<typeof Role>
export type UserStatusT = z.infer<typeof UserStatus>
export type UserT = z.infer<typeof User>
export type TokenPurposeT = z.infer<typeof TokenPurpose>
export type InvitationT = z.infer<typeof Invitation>
export type SessionT = z.infer<typeof Session>
export type AuditActionT = z.infer<typeof AuditAction>
export type AuditEntryT = z.infer<typeof AuditEntry>

/** The part after the @, lowercased. Returns null if there isn't exactly one @. */
export function domainOf(email: string): string | null {
  const parts = email.trim().toLowerCase().split('@')
  return parts.length === 2 && parts[1] ? parts[1] : null
}
