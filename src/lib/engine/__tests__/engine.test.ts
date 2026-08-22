import { describe, it, expect } from 'vitest'
import ledgerRaw from '../../../../data/polyco-ledger.json'
import statementsRaw from '../../../../data/monthly-funding-statements.json'
import { Ledger, Statements } from '../../schema'
import {
  uncoveredAdvance, orderCover, cumulativeSeries, statementFoots,
  recurringMonthlyCost, statementCoverage, duplicatePoRefs, flaggedRows,
  fundingSeries, statementMonths, latestStatement, round2,
} from '../index'

const ledger = Ledger.parse(ledgerRaw)
const statements = Statements.parse(statementsRaw)

describe('Polyco ledger', () => {
  it('parses against the schema', () => {
    expect(ledger.rows.length).toBeGreaterThan(150)
  })

  it('reproduces the uncovered advance at 28 July 2026', () => {
    // received 5,771,014.86 − delivered 3,657,722.12 − 496,489.00
    //          − 137,151.00 − 69,446.40 = 1,410,206.34
    expect(uncoveredAdvance(ledger)).toBe(1410206.34)
  })

  it('agrees with the summary block in the source workbook', () => {
    expect(uncoveredAdvance(ledger)).toBe(ledger.summary.uncovered_advance)
  })

  it('totals the order cover', () => {
    expect(orderCover(ledger)).toBe(703086.4)
  })

  it('does not deduct recharges twice', () => {
    // Recharges sit inside delivered value. Deducting them again would move the
    // figure by their full total, which is the February 2026 error.
    const wrong = uncoveredAdvance(ledger) - ledger.summary.recharges_included_in_delivered
    expect(wrong).not.toBe(1410206.34)
    expect(ledger.summary.recharges_included_in_delivered).toBeGreaterThan(0)
  })

  it('ends the cumulative series with receipts ahead of deliveries', () => {
    const s = cumulativeSeries(ledger)
    const last = s[s.length - 1]
    expect(last.gap).toBeGreaterThan(0)
    expect(last.receivedCumulative).toBeGreaterThan(last.deliveredCumulative)
  })

  it('finds the two known duplicate PO references', () => {
    const dups = duplicatePoRefs(ledger).map((d) => d.po)
    expect(dups).toContain('2466124')
    expect(dups).toContain('2467665')
  })

  it('flags transposed dates rather than silently correcting them', () => {
    expect(flaggedRows(ledger).length).toBeGreaterThan(0)
  })
})

describe('monthly funding statements', () => {
  it('has one statement for every period from June 2025', () => {
    expect(statements.statements.length).toBe(14)
  })

  it('foots every stated total to its own lines', () => {
    for (const s of statements.statements) {
      const f = statementFoots(s)
      expect(`${s.id}:${f.ok}`).toBe(`${s.id}:true`)
    }
  })

  it('matches March 2026 to the cent', () => {
    const r = statements.reconciliation_to_ledger.find((x) => x.period === '2026-03')!
    expect(r.requested).toBe(243105.55)
    expect(r.received_total).toBe(243105.55)
    expect(r.variance).toBe(0)
  })

  it('records the two unmatched 2025 requests', () => {
    const un = statements.reconciliation_to_ledger.filter((r) => r.match_confidence === 'unmatched')
    expect(un.map((r) => r.period).sort()).toEqual(['2025-07', '2025-08'])
  })

  it('strips one-off lines from the recurring cost', () => {
    const jul = statements.statements.find((s) => s.id === '2026-07')!
    const r = recurringMonthlyCost(jul)
    expect(r.total).toBeLessThan(jul.stated_total)
    expect(r.lines.some((l) => /fiber container/i.test(l.description))).toBe(false)
    expect(r.lines.some((l) => /staff salaries/i.test(l.description))).toBe(true)
  })

  it('detects the known period gaps and overlap', () => {
    const c = statementCoverage(statements)
    expect(c.gaps).toContain('2026-04-01 to 2026-04-09')
    expect(c.gaps).toContain('2026-07-11 to 2026-07-14')
    expect(c.overlaps.length).toBeGreaterThan(0)
  })

  it('accumulates funds requested against funds received across all periods', () => {
    const s = fundingSeries(statements)
    expect(s.length).toBe(14)
    const last = s[s.length - 1]
    // Sums of the reconciliation rows: requested 3,059,910.50 and received 2,472,469.31
    expect(last.requestedCumulative).toBe(3059910.5)
    expect(last.receivedCumulative).toBe(2472469.31)
  })

  it('lists every month from June 2025 to August 2026, leaving the missing statement empty', () => {
    const months = statementMonths(statements)
    expect(months.length).toBe(15)
    expect(months[0].id).toBe('2025-06')
    const august = months[months.length - 1]
    expect(august.id).toBe('2026-08')
    expect(august.statement).toBeNull()
    expect(august.recon).toBeNull()
    expect(months.filter((m) => m.statement).length).toBe(14)
  })

  it('bridges the recurring cost back to the stated total through the excluded lines', () => {
    const jul = latestStatement(statements)
    expect(jul.id).toBe('2026-07')
    const r = recurringMonthlyCost(jul)
    // Salaries, rental, supplier payments, GOSI, electricity, petty cash,
    // accommodation and visas on the July 2026 statement.
    expect(r.total).toBe(149485.1)
    const excludedSum = r.excluded.reduce((a, l) => a + l.amount, 0)
    expect(round2(r.total + excludedSum)).toBe(jul.stated_total)
  })
})
