import { STORES } from './config'
import { kv } from './kv'

/**
 * A sliding window, kept as the timestamps of the attempts themselves rather than
 * a counter in a fixed window.
 *
 * A fixed window lets someone take the whole allowance at the end of one window
 * and the whole allowance at the start of the next, so ten per fifteen minutes
 * quietly becomes twenty in a moment. The list stays small because it is pruned
 * before it is checked and nothing is added once the limit is reached, so its
 * length can never exceed the limit.
 */
export type Rule = { limit: number; windowMs: number }

export type Allowance = { allowed: true } | { allowed: false; retryAfterSeconds: number }

type Window = { hits: number[] }

const store = () => kv(STORES.rateLimits)

export async function take(
  bucket: string,
  subject: string,
  rule: Rule,
  now = new Date(),
): Promise<Allowance> {
  const key = `${bucket}:${subject.trim().toLowerCase()}`
  const at = now.getTime()
  const cutoff = at - rule.windowMs

  // Two goes at the compare-and-swap. Beyond that something is genuinely
  // hammering this key, which is the case the limiter exists for.
  for (let attempt = 0; attempt < 2; attempt++) {
    const held = await store().getWithEtag<Window>(key)
    const hits = (held?.value.hits ?? []).filter((t) => t > cutoff)

    if (hits.length >= rule.limit) {
      const oldest = Math.min(...hits)
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((oldest + rule.windowMs - at) / 1000)),
      }
    }

    const next: Window = { hits: [...hits, at] }
    const written = held
      ? await store().replace(key, next, held.etag)
      : await store().create(key, next)

    if (written) return { allowed: true }
  }

  // Fail closed. A limiter that gives up when it is under pressure is not one.
  return { allowed: false, retryAfterSeconds: 1 }
}
