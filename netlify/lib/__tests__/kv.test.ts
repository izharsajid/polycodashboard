import { describe, expect, it } from 'vitest'
import { memoryKv } from '../kv'

/**
 * The contract the repositories rely on. The Blobs implementation gets the same
 * behaviour from conditional writes; this pins down what those tests assume.
 */
describe('the key/value contract', () => {
  it('reads back what it wrote, and null for what it did not', async () => {
    const store = memoryKv()
    await store.put('a', { hello: 'there' })
    expect(await store.get('a')).toEqual({ hello: 'there' })
    expect(await store.get('b')).toBeNull()
  })

  it('copies, so a caller cannot reach back into the store', async () => {
    const store = memoryKv()
    await store.put('a', { count: 1 })
    const first = await store.get<{ count: number }>('a')
    first!.count = 99
    expect(await store.get('a')).toEqual({ count: 1 })
  })

  it('creates only when the key is free', async () => {
    const store = memoryKv()
    expect(await store.create('a', { first: true })).toBe(true)
    expect(await store.create('a', { first: false })).toBe(false)
    expect(await store.get('a')).toEqual({ first: true })
  })

  it('replaces only when nothing changed underneath', async () => {
    const store = memoryKv()
    await store.put('a', { version: 1 })
    const read = await store.getWithEtag('a')

    expect(await store.replace('a', { version: 2 }, read!.etag)).toBe(true)
    // The etag we are holding is now stale.
    expect(await store.replace('a', { version: 3 }, read!.etag)).toBe(false)
    expect(await store.get('a')).toEqual({ version: 2 })
  })

  it('lists by prefix, sorted', async () => {
    const store = memoryKv()
    await store.put('2026-08-22T09:00:00.000Z:b', {})
    await store.put('2026-08-21T09:00:00.000Z:a', {})
    await store.put('other', {})

    expect(await store.keys('2026-08')).toEqual([
      '2026-08-21T09:00:00.000Z:a',
      '2026-08-22T09:00:00.000Z:b',
    ])
    expect(await store.keys()).toHaveLength(3)
  })

  it('deletes', async () => {
    const store = memoryKv()
    await store.put('a', {})
    await store.delete('a')
    expect(await store.get('a')).toBeNull()
    expect(await store.keys()).toEqual([])
  })
})
