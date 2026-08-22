import { getStore, type Store } from '@netlify/blobs'

/**
 * A narrow key/value face over Netlify Blobs.
 *
 * Narrow enough to swap for a map in tests, which means the tests exercise the
 * real repository code rather than a mock of it. Everything auth stores goes
 * through here.
 */
export interface Kv {
  get<T>(key: string): Promise<T | null>
  getWithEtag<T>(key: string): Promise<{ value: T; etag: string } | null>
  put(key: string, value: unknown): Promise<void>
  /** False if the key already exists. */
  create(key: string, value: unknown): Promise<boolean>
  /**
   * False if the entry changed underneath us. The single-use guarantee on
   * invitation and reset tokens rests on this: two requests racing the same
   * link, exactly one wins.
   */
  replace(key: string, value: unknown, etag: string): Promise<boolean>
  delete(key: string): Promise<void>
  keys(prefix?: string): Promise<string[]>
}

/**
 * Inside a function Netlify injects the credentials. A script run locally — the
 * one that sets the first administrator's password — has to be told.
 */
function credentials() {
  const siteID = process.env.NETLIFY_SITE_ID
  const token = process.env.NETLIFY_BLOBS_TOKEN ?? process.env.NETLIFY_AUTH_TOKEN
  return siteID && token ? { siteID, token } : {}
}

function blobsKv(name: string): Kv {
  let store: Store | undefined
  /**
   * Lazily, because getStore throws outside a Netlify context and this module is
   * imported by tests that never touch a real store.
   *
   * Strong consistency is not optional here. Under the default, a token consumed
   * a moment ago can still read as unconsumed, and a lockout can read as clear.
   */
  const s = () => (store ??= getStore({ name, consistency: 'strong', ...credentials() }))

  return {
    async get<T>(key: string) {
      return ((await s().get(key, { type: 'json' })) as T | null) ?? null
    },
    async getWithEtag<T>(key: string) {
      const hit = await s().getWithMetadata(key, { type: 'json' })
      return hit ? { value: hit.data as T, etag: hit.etag ?? '' } : null
    },
    async put(key: string, value: unknown) {
      await s().setJSON(key, value)
    },
    async create(key: string, value: unknown) {
      return (await s().setJSON(key, value, { onlyIfNew: true })).modified
    },
    async replace(key: string, value: unknown, etag: string) {
      // No etag means the entry was read without one; fall back to an
      // unconditional write rather than failing a legitimate update.
      if (!etag) {
        await s().setJSON(key, value)
        return true
      }
      return (await s().setJSON(key, value, { onlyIfMatch: etag })).modified
    },
    async delete(key: string) {
      await s().delete(key)
    },
    async keys(prefix?: string) {
      return (await s().list({ prefix })).blobs.map((b) => b.key)
    },
  }
}

/** For tests. Copies on the way in and out, as a real store would. */
export function memoryKv(): Kv {
  const data = new Map<string, { json: string; etag: string }>()
  let seq = 0
  const write = (key: string, value: unknown) => {
    data.set(key, { json: JSON.stringify(value), etag: `v${++seq}` })
  }

  return {
    async get<T>(key: string) {
      const hit = data.get(key)
      return hit ? (JSON.parse(hit.json) as T) : null
    },
    async getWithEtag<T>(key: string) {
      const hit = data.get(key)
      return hit ? { value: JSON.parse(hit.json) as T, etag: hit.etag } : null
    },
    async put(key: string, value: unknown) {
      write(key, value)
    },
    async create(key: string, value: unknown) {
      if (data.has(key)) return false
      write(key, value)
      return true
    },
    async replace(key: string, value: unknown, etag: string) {
      const hit = data.get(key)
      if (!hit || hit.etag !== etag) return false
      write(key, value)
      return true
    },
    async delete(key: string) {
      data.delete(key)
    },
    async keys(prefix?: string) {
      const all = [...data.keys()]
      return (prefix ? all.filter((k) => k.startsWith(prefix)) : all).sort()
    },
  }
}

const cache = new Map<string, Kv>()
let factory: (name: string) => Kv = blobsKv

export function kv(name: string): Kv {
  let hit = cache.get(name)
  if (!hit) {
    hit = factory(name)
    cache.set(name, hit)
  }
  return hit
}

/** Tests call this before each case. Nothing in production should call it. */
export function useMemoryStores() {
  factory = memoryKv
  cache.clear()
}

export function useBlobStores() {
  factory = blobsKv
  cache.clear()
}
