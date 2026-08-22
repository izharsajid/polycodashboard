import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { TOKEN_BYTES } from './config'

/**
 * Session ids and invitation tokens are bearer secrets: whoever holds one is the
 * user. So they are generated from the system CSPRNG at 256 bits, and only their
 * SHA-256 is ever written down.
 *
 * Storing the hash rather than the token is a small deviation from the record
 * shape sketched in AUTH-SPEC section 6, and it is deliberate. It means a copy of
 * the datastore — a backup, a support session, a mistaken export — yields nothing
 * that can be replayed. A plain SHA-256 is the right tool here rather than
 * Argon2id: the input already has 256 bits of entropy, so there is nothing to
 * brute force and no reason to pay for a slow hash on every request.
 */
export function newToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url')
}

/** Hex, lowercase, 64 characters. Matches the Sha256 schema. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

/** Identifiers that are not secrets: user ids, audit entry ids. */
export function newId(): string {
  return randomUUID()
}
