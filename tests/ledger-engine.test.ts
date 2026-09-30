/**
 * The statement engine against the ledger as recorded. The figures are the ones
 * the polyco-ledger skill asserts, at 28 July 2026.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildLedgerModel } from '../src/engine/ledger'
import { Ledger, LedgerDisputes } from '../src/engine/ledgerSchema'

const read = (p: string) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'))
const ledger = Ledger.parse(read('../data/polyco-ledger.json'))
const disputes = LedgerDisputes.parse(read('../data/ledger-disputes.json'))
const model = buildLedgerModel(ledger, disputes)
const all = [...model.months.flatMap((m) => m.movements), ...model.unresolved]

describe('the position', () => {
  it('works the uncovered advance out to US$1,410,206.34', () => {
    const b = model.bridge
    expect(b.receivedCents).toBe(577_101_486)
    expect(b.deliveredCents).toBe(365_772_212)
    expect(b.balanceCents).toBe(211_329_274)
    expect(b.uncoveredCents).toBe(141_020_634)
  })

  it('never deducts the cargo clearing and freight recharges a second time', () => {
    const b = model.bridge
    expect(b.rechargesCents).toBe(28_373_087)
    // The recharges sit inside delivered value; the advance is not reduced by them again.
    expect(b.uncoveredCents).toBe(
      b.receivedCents - b.deliveredCents - b.pendingPosCents - b.containersReadyCents - b.containersInProcessCents,
    )
    expect(b.uncoveredCents).not.toBe(b.uncoveredCents - b.rechargesCents)
  })

  it('states the as-at date from the data, never from a filename', () => {
    expect(model.asAt).toBe('2026-07-28')
  })
})

describe('the statement', () => {
  it('drops nothing: every delivery and receipt is in a month or in the unresolved list', () => {
    expect(all.filter((m) => m.kind === 'delivery').reduce((a, m) => a + m.cents, 0)).toBe(365_772_212)
    expect(all.filter((m) => m.kind === 'receipt').reduce((a, m) => a + m.cents, 0)).toBe(577_101_486)
    expect(new Set(all.map((m) => m.key)).size).toBe(all.length)
  })

  it('closes on the balance: dated months plus unresolved movements', () => {
    expect(model.datedBalanceCents + model.unresolvedNetCents).toBe(model.bridge.balanceCents)
  })

  it('carries each month end forward from the one before', () => {
    let running = 0
    for (const m of model.months) {
      running += m.receivedCents - m.deliveredCents
      expect(m.balanceCents, m.month).toBe(running)
    }
  })
})

describe('what stays unresolved', () => {
  const unresolvedRows = (status: string) =>
    model.unresolved.filter((m) => m.dateStatus === status).map((m) => `${m.sourceRow}${m.kind[0]}`)

  it('holds the 220,000.00 receipt that the October 2025 actuals statement dates differently', () => {
    const disputed = model.unresolved.find((m) => m.sourceRow === 122)!
    expect(disputed.kind).toBe('receipt')
    expect(disputed.cents).toBe(22_000_000)
    expect(disputed.dateStatus).toBe('disputed')
    expect(disputed.dateNote).toContain('6 October 2025')
  })

  it('keeps every day/month swap the importer made out of the months until confirmed', () => {
    expect(unresolvedRows('disputed').sort()).toEqual(
      ['118d', '122r', '129d', '150r', '163r', '165r', '167d', '168d'].sort(),
    )
  })

  it('keeps every movement with no usable date out of the months', () => {
    expect(unresolvedRows('missing')).toHaveLength(13)
    expect(model.months.flatMap((m) => m.movements).every((m) => m.date !== null)).toBe(true)
  })

  it('marks each receipt not tied to a PO as unattributed', () => {
    expect(model.unattributed.count).toBe(40)
    expect(all.filter((m) => m.kind === 'delivery').some((m) => m.unattributed)).toBe(false)
  })
})
