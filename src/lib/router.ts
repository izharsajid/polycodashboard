/**
 * Five flat routes, no nesting and no data loaders. A router library would be a
 * dependency and a chunk of bundle for something this shape does not need.
 *
 * Everything here is a pure function of a path, so the rules that decide what
 * gets rendered can be tested without a browser.
 */
export const LOGIN = '/login'
export const FORGOT = '/forgot'
export const INVITE = '/invite'
export const RESET = '/reset'
export const DASHBOARD = '/'

/**
 * The pages a signed-out visitor may see. Everything else needs a session.
 *
 * This is the front of the guard, not the guard. It decides what to render; the
 * server decides what to answer. AUTH-SPEC section 8: hiding a link in the
 * interface is not access control.
 */
export function isPublic(path: string): boolean {
  return path === LOGIN || path === FORGOT || path === INVITE || path === RESET
}

/**
 * The token out of an invitation or reset link. It travels in the fragment, which
 * the browser keeps to itself, so it is never in a path and never in a query.
 */
export function tokenFromHash(hash: string): string | null {
  const token = hash.startsWith('#') ? hash.slice(1) : hash
  return token.length > 0 ? decodeURIComponent(token) : null
}

/** Where to send someone who asked for a page without being signed in. */
export function loginPathFor(path: string): string {
  if (path === DASHBOARD || isPublic(path)) return LOGIN
  return `${LOGIN}?next=${encodeURIComponent(path)}`
}

/** Tab, newline and friends, plus DEL. No escapes in a regex, no surprises. */
function hasControlCharacter(value: string): boolean {
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0
    if (code < 0x20 || code === 0x7f) return true
  }
  return false
}

/** One slash, then something that is not another slash or a backslash. */
const PLAIN_LOCAL_PATH = /^\/[^/\\]/

/**
 * Where to go once they are in.
 *
 * Anything that is not a plain path on this site is thrown away. To a browser,
 * `//evil.example` and `/\evil.example` are both absolute URLs somewhere else,
 * and honouring either would turn the login page into an open redirect that any
 * convincing email could point at. Control characters go too: a tab or a newline
 * is stripped by some URL parsers before the rest is resolved, which is how a
 * path that looks local stops being one.
 */
export function safeNext(raw: string | null | undefined): string {
  if (!raw || raw === DASHBOARD) return DASHBOARD
  if (hasControlCharacter(raw)) return DASHBOARD
  if (!PLAIN_LOCAL_PATH.test(raw)) return DASHBOARD
  return raw
}

export function nextFrom(search: string): string {
  return safeNext(new URLSearchParams(search).get('next'))
}
