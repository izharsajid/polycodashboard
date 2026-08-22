/**
 * The only way the interface talks to the server.
 *
 * The session travels as an HttpOnly cookie, so there is no token to attach and
 * nothing for this module to hold. If a call comes back 401, the session is over,
 * whatever the page currently believes.
 */
export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string }

const UNREACHABLE = 'Could not reach the server. Check your connection and try again.'
const UNEXPLAINED = 'Something went wrong at our end. Try again in a moment.'

async function request<T>(path: string, init: RequestInit = {}): Promise<ApiResult<T>> {
  let res: Response
  try {
    res = await fetch(path, {
      ...init,
      // The cookie is same-origin and must go with every call, including the
      // ones a browser would otherwise send bare.
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
    })
  } catch {
    return { ok: false, status: 0, error: UNREACHABLE }
  }

  const body = (await res.json().catch(() => null)) as { error?: string } | null

  if (!res.ok) {
    return { ok: false, status: res.status, error: body?.error ?? UNEXPLAINED }
  }
  return { ok: true, data: body as T }
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body ?? {}) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
}
