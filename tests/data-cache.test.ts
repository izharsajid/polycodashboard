import { beforeEach, describe, expect, it } from 'vitest'
import { cached, clearCache, load } from '../src/data/cache'
import type { ApiResult } from '../src/lib/api'

let calls = 0
const ok = (data: unknown) => async (): Promise<ApiResult<unknown>> => {
  calls += 1
  return { ok: true, data }
}
const down = async (): Promise<ApiResult<unknown>> => {
  calls += 1
  return { ok: false, status: 502, error: 'efdashboard.com answered 502' }
}

beforeEach(() => {
  clearCache()
  calls = 0
})

describe('the shared data cache', () => {
  it('fetches once, then answers from memory while fresh', async () => {
    await load('/api/tracker', { get: ok(1), now: () => 0 })
    const again = await load('/api/tracker', { get: ok(2), now: () => 10_000 })
    expect(again).toEqual({ ok: true, data: 1 })
    expect(calls).toBe(1)
    expect(cached('/api/tracker')).toEqual({ ok: true, data: 1 })
  })

  it('fetches again once the copy is stale, or when forced', async () => {
    await load('/api/tracker', { get: ok(1), now: () => 0 })
    expect(await load('/api/tracker', { get: ok(2), now: () => 31_000 })).toEqual({ ok: true, data: 2 })
    expect(await load('/api/tracker', { get: ok(3), now: () => 31_001, force: true })).toEqual({ ok: true, data: 3 })
    expect(calls).toBe(3)
  })

  it('shares one request between tabs asking at the same moment', async () => {
    const [a, b] = await Promise.all([load('/api/machines', { get: ok('plan') }), load('/api/machines', { get: ok('plan') })])
    expect(a).toEqual(b)
    expect(calls).toBe(1)
  })

  it('keeps the last good copy when a refresh fails', async () => {
    await load('/api/tracker', { get: ok(1), now: () => 0 })
    expect(await load('/api/tracker', { get: down, now: () => 60_000 })).toMatchObject({ ok: false })
    expect(cached('/api/tracker')).toEqual({ ok: true, data: 1 })
  })
})
