import { describe, expect, it } from 'vitest'
import ledgerRaw from '../../../../data/polyco-ledger.json'
import statementsRaw from '../../../../data/monthly-funding-statements.json'
import trackerRaw from '../../../../data/po-tracker.json'
import { Ledger, PoTracker, Statements } from '../../schema'
import { orderCover, recurringMonthlyCost, latestStatement } from '../index'
import { HORIZON_MONTHS, averageOrdersPerMonth, forecast, observedDispatchRate } from '../forecast'

const ledger = Ledger.parse(ledgerRaw)
const statements = Statements.parse(statementsRaw)
const tracker = PoTracker.parse(trackerRaw)
const TODAY = '2026-08-23'

const run = (scenario: 'current-book' | 'last-twelve' | 'order-by-order') =>
  forecast({ ledger, tracker, statements, scenario, today: TODAY })

describe('the six-month forecast', () => {
  it('projects exactly six months, in order, starting next month', () => {
    const f = run('current-book')
    expect(f.months).toHaveLength(HORIZON_MONTHS)
    expect(f.months[0].period).toBe('2026-09')
    expect(f.months[5].period).toBe('2027-02')
  })

  it('takes every input from figures the dashboard already shows', () => {
    const f = run('current-book')
    // No new figure: the monthly cost is the one Tab 2 derives.
    expect(f.monthlyCost).toBe(recurringMonthlyCost(latestStatement(statements)).total)
  })

  it('works the advance off as the open book ships', () => {
    const f = run('current-book')
    const balances = f.months.map((m) => m.balance)
    // Nothing new arrives in this scenario, so the balance only falls.
    expect(balances.every((b, i) => i === 0 || b <= balances[i - 1])).toBe(true)
  })

  it('never ships more than the book holds', () => {
    const f = run('current-book')
    const shipped = f.months.reduce((total, m) => total + m.shipping, 0)
    expect(shipped).toBeLessThanOrEqual(orderCover(ledger) + 0.01)
  })

  it('accumulates the cost of staying open, month by month', () => {
    const f = run('current-book')
    expect(f.months[0].cumulativeCost).toBe(f.monthlyCost)
    expect(f.months[5].cumulativeCost).toBe(Math.round(f.monthlyCost * 6 * 100) / 100)
  })

  it('says which month the book runs out, or that it does not inside the horizon', () => {
    const f = run('current-book')
    if (f.bookRunsOutIn !== null) {
      expect(f.months.some((m) => m.period === f.bookRunsOutIn && m.bookExhausted)).toBe(true)
    } else {
      expect(f.months.every((m) => !m.bookExhausted)).toBe(true)
    }
  })

  it('holds more of the advance open when Polyco keeps ordering', () => {
    const nothingNew = run('current-book')
    const keepsOrdering = run('last-twelve')
    const last = HORIZON_MONTHS - 1
    expect(keepsOrdering.months[last].balance).toBeGreaterThanOrEqual(
      nothingNew.months[last].balance,
    )
  })

  it('lets a settable monthly volume drive the third scenario', () => {
    const quiet = forecast({
      ledger, tracker, statements, scenario: 'order-by-order', today: TODAY,
      monthlyOrderValue: 0,
    })
    const busy = forecast({
      ledger, tracker, statements, scenario: 'order-by-order', today: TODAY,
      monthlyOrderValue: 500_000,
    })
    expect(busy.months[5].balance).toBeGreaterThan(quiet.months[5].balance)
  })

  it('names every assumption with where it came from', () => {
    const f = run('current-book')
    expect(f.assumptions.length).toBeGreaterThanOrEqual(5)
    for (const assumption of f.assumptions) {
      expect(assumption.source).not.toBe('')
      expect(assumption.label).not.toBe('')
    }
    // The one genuine estimate says so.
    expect(f.assumptions.some((a) => /assumption/i.test(a.source))).toBe(true)
  })

  it('reads the dispatch rate off the tracker rather than assuming one', () => {
    expect(observedDispatchRate(tracker, TODAY)).toBeGreaterThan(0)
    expect(averageOrdersPerMonth(tracker, TODAY, 3)).toBeGreaterThanOrEqual(0)
  })
})
