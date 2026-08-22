/**
 * Auth configuration, in one place so a change is a one-line reviewable diff.
 *
 * None of these are business figures. CLAUDE.md's rule about numeric literals
 * covers the numbers Polyco sees; session lifetimes and hashing parameters are
 * mechanism, and hiding them in /data would make them harder to review, not
 * easier.
 */

/** AUTH-SPEC section 6: 12 hours idle, 7 days absolute. */
export const SESSION_IDLE_MS = 12 * 60 * 60 * 1000
export const SESSION_ABSOLUTE_MS = 7 * 24 * 60 * 60 * 1000

/** AUTH-SPEC section 4: an invitation lives 7 days, a reset 1 hour. */
export const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000
export const RESET_TTL_MS = 60 * 60 * 1000

/** AUTH-SPEC section 4. Length beats complexity, so there is no upper rule but a cap. */
export const PASSWORD_MIN_LENGTH = 12
/** Argon2id hashes the whole input; the cap only stops someone posting a megabyte. */
export const PASSWORD_MAX_LENGTH = 256

/** AUTH-SPEC section 5. Enforced at gate 8; the fields and values exist from the start. */
export const LOCKOUT_THRESHOLD = 10
export const LOCKOUT_MS = 15 * 60 * 1000

/** AUTH-SPEC section 1. A member may invite within their own domain only. */
export const PERMITTED_INVITE_DOMAINS = ['polycohealthline.com', 'ecofibre.bh'] as const

/**
 * OWASP's first recommended Argon2id profile: m=19456 KiB, t=2, p=1. Comfortable
 * inside a Netlify Function and fast enough that a sign-in does not feel slow.
 */
export const ARGON2 = {
  parallelism: 1,
  iterations: 2,
  memorySize: 19456,
  hashLength: 32,
} as const

export const SALT_BYTES = 16
/** 256 bits, as AUTH-SPEC section 6 requires for sessions and invitations. */
export const TOKEN_BYTES = 32

/**
 * The __Host- prefix binds the cookie to this exact origin: a sibling host cannot
 * set it and it cannot be widened to a parent domain. The browser enforces that
 * only if Secure and Path=/ are both present, which is why they are not optional
 * in sessionCookie(). Note that this means local dev must be served over https,
 * or from a host the browser treats as trustworthy such as localhost.
 */
export const SESSION_COOKIE = '__Host-ef_session'

/** One store per collection, as AUTH-SPEC section 6 sets out. */
export const STORES = {
  users: 'users',
  invitations: 'invitations',
  sessions: 'sessions',
  audit: 'audit',
} as const
