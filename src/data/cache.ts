import { api, type ApiResult } from '../lib/api'

/**
 * One copy of each endpoint's answer, shared by every tab. Switching tabs shows
 * what was already fetched at once instead of asking efdashboard.com again;
 * a copy older than FRESH_MS is fetched again in the background, and two tabs
 * asking at the same moment share one request. A failed refresh keeps the last
 * good copy, so a slow master never blanks a page that already had data.
 */
export const FRESH_MS = 30_000

type Entry = { at: number; result: Extract<ApiResult<unknown>, { ok: true }> | null; inflight: Promise<ApiResult<unknown>> | null }
const entries = new Map<string, Entry>()

/** The last good answer for a path, if there is one. */
export function cached(path: string): ApiResult<unknown> | null {
  return entries.get(path)?.result ?? null
}

/** Whether the copy for a path is recent enough not to fetch again. */
export function isFresh(path: string, now = Date.now()): boolean {
  const e = entries.get(path)
  return Boolean(e?.result && now - e.at < FRESH_MS)
}

export function load(
  path: string,
  { get = api.get, now = Date.now, force = false }: { get?: (path: string) => Promise<ApiResult<unknown>>; now?: () => number; force?: boolean } = {},
): Promise<ApiResult<unknown>> {
  const entry = entries.get(path) ?? { at: 0, result: null, inflight: null }
  entries.set(path, entry)
  if (entry.inflight) return entry.inflight
  if (!force && entry.result && now() - entry.at < FRESH_MS) return Promise.resolve(entry.result)
  entry.inflight = get(path).then((result) => {
    entry.inflight = null
    if (result.ok) {
      entry.result = result
      entry.at = now()
    }
    return result
  })
  return entry.inflight
}

/** Start fetching paths a reader is likely to open next. */
export function prefetch(paths: string[]) {
  for (const p of paths) void load(p)
}

/** For tests. */
export function clearCache() {
  entries.clear()
}
