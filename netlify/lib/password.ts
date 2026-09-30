import { argon2id, argon2Verify } from 'hash-wasm'
import { randomBytes } from 'node:crypto'
import { ARGON2, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, SALT_BYTES } from './config'
import { COMMON_PASSWORD_ROOTS } from './common-passwords'

/**
 * Argon2id, via hash-wasm.
 *
 * WebAssembly rather than a native binding on purpose: there is no .node binary
 * to bundle, nothing to rebuild for the Lambda architecture, and no way for a
 * deploy to succeed locally and fail in production because the native module did
 * not come along. A handful of sign-ins a day does not need the last word in
 * throughput.
 *
 * The returned string is the PHC encoded form, which carries the salt and the
 * parameters with it. Nothing else needs to be stored, and the parameters can be
 * raised later without invalidating existing hashes.
 */
export async function hashPassword(password: string): Promise<string> {
  return argon2id({
    password,
    salt: randomBytes(SALT_BYTES),
    outputType: 'encoded',
    ...ARGON2,
  })
}

/**
 * False rather than throwing on a malformed hash. A corrupt record must read as
 * "wrong password", not as a 500 that tells the caller something interesting.
 */
export async function verifyPassword(password: string, hash: string | null): Promise<boolean> {
  if (!hash) return false
  try {
    return await argon2Verify({ password, hash })
  } catch {
    return false
  }
}

export type PasswordVerdict = { ok: true } | { ok: false; reason: string }

/**
 * AUTH-SPEC section 4: at least 12 characters, checked against a common-password
 * list, no composition rules, no forced rotation.
 *
 * The guessability checks below are not composition rules. A composition rule
 * says "you must include a digit" and reliably produces Password1. These say "not
 * this specific guess", which is the check that carries weight.
 *
 * The reasons are shown to the person choosing the password, which is the one
 * place a specific message belongs — they cannot fix what they are not told. The
 * generic-error rule in AUTH-SPEC section 9 is about not disclosing whether an
 * account exists, and none of these touch that.
 */
export function checkPassword(
  password: string,
  context: { email?: string | null; name?: string | null } = {},
): PasswordVerdict {
  const characters = Array.from(password)
  if (characters.length > PASSWORD_MAX_LENGTH) {
    return { ok: false, reason: `Use no more than ${PASSWORD_MAX_LENGTH} characters.` }
  }
  if (Array.from(password.trim()).length < PASSWORD_MIN_LENGTH) {
    return { ok: false, reason: `Use at least ${PASSWORD_MIN_LENGTH} characters.` }
  }

  const normalised = password.trim().toLowerCase()

  if (new Set(normalised).size < 5) {
    return { ok: false, reason: 'Use a wider mix of characters, not one repeated a few times.' }
  }
  if (isRun(normalised)) {
    return { ok: false, reason: 'That is a straight run along the keyboard or the number row.' }
  }
  for (const root of roots(normalised)) {
    if (COMMON_PASSWORD_ROOTS.has(root)) {
      return { ok: false, reason: 'That is a well known password, or a well known one with padding.' }
    }
  }
  for (const word of contextWords(context)) {
    if (normalised.includes(word)) {
      return { ok: false, reason: 'Avoid your own name, your email address or the company name.' }
    }
  }
  return { ok: true }
}

/**
 * password1234 and !!!qwerty!!! are the same guess as password and qwerty. Strip
 * the padding and look up what is left.
 */
function roots(normalised: string): string[] {
  // The common substitutions, undone: p@ssw0rd is password.
  const unleet = normalised
    .replace(/[0]/g, 'o')
    .replace(/[1]/g, 'l')
    .replace(/[3]/g, 'e')
    .replace(/[4@]/g, 'a')
    .replace(/[5$]/g, 's')
    .replace(/[7]/g, 't')

  const out = new Set<string>()
  for (const candidate of [normalised, unleet]) {
    out.add(candidate)
    out.add(candidate.replace(/[^a-z]+$/, ''))
    out.add(candidate.replace(/^[^a-z]+/, '').replace(/[^a-z]+$/, ''))
    out.add(candidate.replace(/[^a-z]/g, ''))
  }
  out.delete('')
  return [...out]
}

/** abcdefghijkl and 987654321098 — every step the same distance, up or down. */
function isRun(value: string): boolean {
  if (value.length < 4) return false
  const step = value.charCodeAt(1) - value.charCodeAt(0)
  if (step !== 1 && step !== -1) return false
  for (let i = 2; i < value.length; i++) {
    if (value.charCodeAt(i) - value.charCodeAt(i - 1) !== step) return false
  }
  return true
}

/**
 * The words this particular set of people would reach for. NIST 800-63B calls
 * these context-specific words and recommends refusing them alongside the common
 * list; they are the guess anyone who knows where you work would try.
 */
function contextWords(context: { email?: string | null; name?: string | null }): string[] {
  const words = ['ecofibre', 'ecofiber', 'polyco', 'polycohealthline', 'healthline']
  const local = context.email?.split('@')[0]?.toLowerCase()
  if (local) words.push(...local.split(/[^a-z0-9]+/i).filter((p) => p.length >= 4))
  if (context.name) {
    words.push(...context.name.toLowerCase().split(/[^a-z0-9]+/i).filter((p) => p.length >= 4))
  }
  return words
}
