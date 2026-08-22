import { describe, expect, it } from 'vitest'
import ledgerRaw from '../../../../data/polyco-ledger.json'
import { Ledger } from '../../schema'
import { round2 } from '../index'
import { statementEntries, statementTie, statementView } from '../statement'

const ledger = Ledger.parse(ledgerRaw)

describe('the entries', () => {
  it('never drops a ledger row', () => {
    const entries = statementEntries(ledger)
    const covered = new Set(entries.map((e) => e.sourceRow))
    const expected = new Set(ledger.rows.map((r) => r.source_row))

    expect(covered.size).toBe(expected.size)
    for (const row of expected) expect(covered.has(row)).toBe(true)
  })

  it('splits a row carrying both a receipt and a delivery into two entries', () => {
    const both = ledger.rows.filter((r) => r.received && r.delivered_value)
    expect(both.length).toBe(19)

    const entries = statementEntries(ledger)
    for (const row of both) {
      const mine = entries.filter((e) => e.sourceRow === row.source_row)
      expect(mine.map((e) => e.kind).sort()).toEqual(['delivery', 'receipt'])
    }
  })

  it('keeps the workbook line on both halves, so a reconciler can trace back', () => {
    const row = ledger.rows.find((r) => r.received && r.delivered_value)!
    const mine = statementEntries(ledger).filter((e) => e.sourceRow === row.source_row)

    expect(mine).toHaveLength(2)
    expect(new Set(mine.map((e) => e.sourceRow))).toEqual(new Set([row.source_row]))
    expect(new Set(mine.map((e) => e.id)).size).toBe(2)
  })

  it('carries every receipt and every delivery exactly once', () => {
    const entries = statementEntries(ledger)
    const received = round2(entries.reduce((t, e) => t + e.received, 0))
    const delivered = round2(entries.reduce((t, e) => t + e.delivered, 0))

    expect(received).toBe(ledger.summary.total_received)
    expect(delivered).toBe(ledger.summary.total_delivered)
  })

  it('sorts by date, and sorts what has no date to the end', () => {
    const entries = statementEntries(ledger)
    const firstUndated = entries.findIndex((e) => e.date === null)

    expect(firstUndated).toBeGreaterThan(0)
    // Nothing dated appears after the first undated entry.
    expect(entries.slice(firstUndated).every((e) => e.date === null)).toBe(true)

    const dates = entries.slice(0, firstUndated).map((e) => e.date!)
    expect([...dates].sort()).toEqual(dates)
  })

  it('invents no date to make the sort tidy', () => {
    const undated = statementEntries(ledger).filter((e) => e.date === null)
    expect(undated.length).toBeGreaterThan(0)
    expect(undated.every((e) => e.date === null)).toBe(true)
  })

  it('marks a corrected date as unconfirmed, and leaves an undoubted one alone', () => {
    const entries = statementEntries(ledger)
    const unconfirmed = entries.filter((e) => e.dateUnconfirmed)

    expect(unconfirmed.length).toBeGreaterThan(0)
    for (const entry of unconfirmed) {
      expect(entry.flags.length).toBeGreaterThan(0)
      expect(entry.originalDate).not.toBe(entry.date)
    }
    // A flag about something other than the date does not make the date doubtful.
    expect(entries.some((e) => e.flags.length > 0 && !e.dateUnconfirmed)).toBe(true)
  })
})

describe('the reconciliation', () => {
  it('opens at zero, unfiltered', () => {
    expect(statementView(ledger).opening).toBe(0)
  })

  it('closes at opening plus movement', () => {
    const view = statementView(ledger)
    expect(view.closing).toBe(round2(view.opening + view.movement))
  })

  it('ends the running balance where the statement closes', () => {
    const view = statementView(ledger)
    expect(view.entries[view.entries.length - 1].balance).toBe(view.closing)
  })

  it('runs the balance so every row is the one before it plus its own movement', () => {
    const view = statementView(ledger)
    let balance = view.opening
    for (const entry of view.entries) {
      balance = round2(balance + entry.movement)
      expect(`${entry.id}:${entry.balance}`).toBe(`${entry.id}:${balance}`)
    }
  })

  it('ties the unfiltered closing to the ledger summary', () => {
    const tie = statementTie(ledger)
    expect(tie.closing).toBe(2113292.74)
    expect(tie.receivedLessDelivered).toBe(2113292.74)
    expect(tie.tiesToLedgerSummary).toBe(true)
  })

  it('ties to Tab 1 once the order cover comes off', () => {
    const tie = statementTie(ledger)
    // The closing balance is what has been received less delivered. Tab 1's
    // headline takes off open orders and containers already made, which are
    // commitments and cannot sit in a running balance.
    expect(tie.orderCover).toBe(703086.4)
    expect(round2(tie.closing - tie.orderCover)).toBe(1410206.34)
    expect(tie.uncoveredAdvance).toBe(1410206.34)
    expect(tie.tiesToTab1).toBe(true)
  })

  it('holds the convention: receipts raise the balance, deliveries lower it', () => {
    const view = statementView(ledger)
    const receipt = view.entries.find((e) => e.kind === 'receipt')!
    const delivery = view.entries.find((e) => e.kind === 'delivery')!

    expect(receipt.movement).toBeGreaterThan(0)
    expect(delivery.movement).toBeLessThan(0)
    // Positive means EcoFibre holds value yet to be delivered.
    expect(view.closing).toBeGreaterThan(0)
  })
})

describe('a date range', () => {
  const RANGE = { from: '2026-01-01', to: '2026-03-31' }

  it('opens at the closing balance of everything before it, not at zero', () => {
    const view = statementView(ledger, RANGE)
    const before = statementView(ledger, { to: '2025-12-31' })

    expect(view.opening).not.toBe(0)
    expect(view.opening).toBe(before.closing)
  })

  it('still closes at opening plus movement', () => {
    const view = statementView(ledger, RANGE)
    expect(view.closing).toBe(round2(view.opening + view.movement))
  })

  it('shows only what falls inside the range', () => {
    const view = statementView(ledger, RANGE)
    expect(view.entries.length).toBeGreaterThan(0)
    for (const entry of view.entries) {
      expect(entry.date! >= RANGE.from && entry.date! <= RANGE.to).toBe(true)
    }
  })

  it('joins up: the balance carried out of one period opens the next', () => {
    const first = statementView(ledger, { to: '2025-12-31' })
    const second = statementView(ledger, { from: '2026-01-01', to: '2026-03-31' })
    const third = statementView(ledger, { from: '2026-04-01' })

    expect(second.opening).toBe(first.closing)
    expect(third.opening).toBe(second.closing)
  })

  it('sets undated entries aside rather than dropping them, and says how much', () => {
    const view = statementView(ledger, RANGE)

    // Section 2: closing equals opening plus the movement in the period shown,
    // and an entry with no date is in no period. Section 7: say where it went.
    expect(view.entries.every((e) => e.date !== null)).toBe(true)
    expect(view.undated.length).toBeGreaterThan(0)
    expect(view.undatedTotal).not.toBe(0)
  })

  it('carries the undated entries inside the closing when nothing is filtered', () => {
    const view = statementView(ledger)
    const undatedInSequence = view.entries.filter((e) => e.date === null)

    expect(undatedInSequence.length).toBe(view.undated.length)
    // Which is what makes the unfiltered closing tie to the ledger.
    expect(view.closing).toBe(2113292.74)
  })

  it('counts the unconfirmed dates in what is shown', () => {
    expect(statementView(ledger).unconfirmedDates).toBeGreaterThan(0)
    expect(statementView(ledger, { from: '2030-01-01' }).unconfirmedDates).toBe(0)
  })

  it('returns an empty period honestly, still opening at the right balance', () => {
    const view = statementView(ledger, { from: '2030-01-01', to: '2030-12-31' })

    expect(view.entries).toHaveLength(0)
    expect(view.movement).toBe(0)
    expect(view.closing).toBe(view.opening)
    // Everything dated, which is the unfiltered closing less the undated entries
    // that a range sets aside. Rounded, because the engine rounds at every step
    // and an unrounded expectation here drifts by a fraction of a cent.
    expect(view.opening).toBe(round2(2113292.74 - statementView(ledger).undatedTotal))
  })
})
