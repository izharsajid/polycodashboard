import { beforeEach, describe, expect, it } from 'vitest'
import * as auditModule from '../audit'
import { listAudit, record } from '../audit'
import { useMemoryStores } from '../kv'

const MINUTE = 60 * 1000
const START = new Date('2026-08-22T09:00:00.000Z')
const after = (ms: number) => new Date(START.getTime() + ms)

beforeEach(() => {
  useMemoryStores()
})

describe('the audit log', () => {
  it('records who, what, when, from where and how it went', async () => {
    await record(
      {
        action: 'sign_in',
        result: 'success',
        actorId: 'u-izhar',
        actorEmail: 'Izhar@EcoFibre.BH',
        ip: '1.2.3.4',
      },
      START,
    )

    const [entry] = await listAudit()
    expect(entry.action).toBe('sign_in')
    expect(entry.result).toBe('success')
    expect(entry.actorId).toBe('u-izhar')
    expect(entry.actorEmail).toBe('izhar@ecofibre.bh')
    expect(entry.ip).toBe('1.2.3.4')
    expect(entry.timestamp).toBe('2026-08-22T09:00:00.000Z')
  })

  it('records a failure as readily as a success', async () => {
    await record(
      { action: 'sign_in_failed', result: 'failure', actorEmail: 'someone@example.com' },
      START,
    )
    await record(
      {
        action: 'invitation_refused_domain',
        result: 'failure',
        actorId: 'u-izhar',
        target: 'someone@gmail.com',
        detail: 'domain not permitted',
      },
      after(MINUTE),
    )

    const entries = await listAudit()
    expect(entries.map((e) => e.action)).toEqual(['invitation_refused_domain', 'sign_in_failed'])
    expect(entries.every((e) => e.result === 'failure')).toBe(true)
  })

  it('reads newest first', async () => {
    await record({ action: 'sign_in', result: 'success', actorId: 'a' }, START)
    await record({ action: 'sign_out', result: 'success', actorId: 'a' }, after(MINUTE))
    await record({ action: 'password_changed', result: 'success', actorId: 'a' }, after(2 * MINUTE))

    expect((await listAudit()).map((e) => e.action)).toEqual([
      'password_changed',
      'sign_out',
      'sign_in',
    ])
  })

  it('keeps both of two events in the same millisecond', async () => {
    await record({ action: 'sign_in', result: 'success', actorId: 'a' }, START)
    await record({ action: 'sign_in', result: 'success', actorId: 'b' }, START)
    expect(await listAudit()).toHaveLength(2)
  })

  it('filters by actor, action and date range', async () => {
    await record({ action: 'sign_in', result: 'success', actorId: 'u-izhar' }, START)
    await record({ action: 'sign_in', result: 'success', actorId: 'u-hamza' }, after(MINUTE))
    await record({ action: 'role_changed', result: 'success', actorId: 'u-izhar' }, after(2 * MINUTE))

    expect(await listAudit({ actorId: 'u-izhar' })).toHaveLength(2)
    expect(await listAudit({ action: 'sign_in' })).toHaveLength(2)
    expect(
      await listAudit({ from: after(MINUTE).toISOString(), to: after(2 * MINUTE).toISOString() }),
    ).toHaveLength(1)
  })

  it('caps what it returns', async () => {
    for (let i = 0; i < 5; i++) {
      await record({ action: 'sign_in', result: 'success', actorId: 'a' }, after(i * MINUTE))
    }
    expect(await listAudit({ limit: 2 })).toHaveLength(2)
  })

  it('offers no way to delete or amend an entry', async () => {
    // AUTH-SPEC section 7: append only, no delete endpoint. The module exports a
    // writer and a reader, so there is nothing to call and nothing to wire up by
    // accident later.
    expect(Object.keys(auditModule).sort()).toEqual(['auditKey', 'listAudit', 'record'])
  })
})
