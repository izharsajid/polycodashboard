import { describe, expect, it } from 'vitest'
import ledgerRaw from '../../../../data/polyco-ledger.json'
import statementsRaw from '../../../../data/monthly-funding-statements.json'
import { Ledger, Statements } from '../../schema'
import { millions, monthName, positionFinding, settlementFinding } from '../findings'

const ledger = Ledger.parse(ledgerRaw)
const statements = Statements.parse(statementsRaw)

describe('the finding at the top of Tab 1', () => {
  it('states the three figures the tiles show, from the same source', () => {
    const finding = positionFinding(ledger)

    expect(finding.received).toBe(ledger.summary.total_received)
    expect(finding.delivered).toBe(ledger.summary.total_delivered)
    expect(finding.uncovered).toBe(1410206.34)
  })

  it('reads as a statement, and carries every figure it mentions', () => {
    const { sentence } = positionFinding(ledger)

    expect(sentence).toContain('$5.77m')
    expect(sentence).toContain('$3.66m')
    expect(sentence).toContain('$1.41m')
    expect(sentence.split(' ').length).toBeLessThan(40)
  })

  it('cannot drift from the engine, because it is the engine', () => {
    // The point of generating it: change the ledger and the sentence follows.
    const smaller = {
      ...ledger,
      summary: { ...ledger.summary, total_received: 4_000_000 },
    }
    expect(positionFinding(smaller).sentence).toContain('$4.00m')
    expect(positionFinding(smaller).sentence).not.toContain('$5.77m')
  })
})

describe('the finding at the top of Tab 2', () => {
  it('finds the unbroken run of confirmed settlements at the end of the series', () => {
    const finding = settlementFinding(statements)!

    // 2026-01 through 2026-07 are confirmed; 2025-12 is only probable.
    expect(finding.fromPeriod).toBe('2026-01')
    expect(finding.months).toBe(7)
  })

  it('reports the largest gap inside that run rather than glossing it', () => {
    const finding = settlementFinding(statements)!

    // January 2026 fell short by 25,799, which is the one material gap in the run
    // and the thing a reader most needs to see.
    expect(finding.largestGap).toBe(25799)
    expect(finding.sentence).toContain('$25,799')
    expect(finding.sentence).toContain('January 2026')
  })

  it('stops at the first reconciliation that is not confirmed', () => {
    const broken = {
      ...statements,
      reconciliation_to_ledger: statements.reconciliation_to_ledger.map((r) =>
        r.period === '2026-05' ? { ...r, match_confidence: 'partial' as const } : r,
      ),
    }
    const finding = settlementFinding(broken)!
    expect(finding.fromPeriod).toBe('2026-06')
    expect(finding.months).toBe(2)
  })

  it('returns nothing rather than a misleading run when the latest is unmatched', () => {
    const broken = {
      ...statements,
      reconciliation_to_ledger: statements.reconciliation_to_ledger.map((r) =>
        r.period === '2026-07' ? { ...r, match_confidence: 'unmatched' as const } : r,
      ),
    }
    expect(settlementFinding(broken)).toBeNull()
  })
})

describe('formatting helpers', () => {
  it('abbreviates to millions for prose only', () => {
    expect(millions(5771014.86)).toBe('$5.77m')
    expect(millions(1410206.34)).toBe('$1.41m')
    expect(millions(-25799)).toBe('($0.03m)')
  })

  it('names a month', () => {
    expect(monthName('2026-01')).toBe('January 2026')
    expect(monthName('2025-12')).toBe('December 2025')
  })
})
