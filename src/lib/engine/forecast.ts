import type { LedgerT, PoTrackerT, StatementsT } from '../schema'
import { latestStatement, orderCover, recurringMonthlyCost, round2, uncoveredAdvance } from './index'
import { advanceBalanceSeries } from './statement'

/**
 * Six months out, from the ledger, the tracker and the recurring monthly cost.
 *
 * REDESIGN-2-SPEC section 8. Nothing here needs the machine data the capacity
 * tabs are waiting on, and nothing here invents a figure: every input is one the
 * dashboard already shows, and each is named on the page with its source.
 */
export type ScenarioKey = 'current-book' | 'last-twelve' | 'order-by-order'

export type ForecastMonth = {
  /** `2026-09` */
  period: string
  /** Value shipping out of the open book that month. */
  shipping: number
  /** New orders arriving that month, under the scenario. */
  newOrders: number
  /** The advance balance at the end of the month. */
  balance: number
  /** Cumulative cost of holding the operation open, to the end of this month. */
  cumulativeCost: number
  /** True once the open book has been exhausted. */
  bookExhausted: boolean
}

export type ForecastAssumption = { label: string; value: string; source: string }

export type Forecast = {
  scenario: ScenarioKey
  months: ForecastMonth[]
  /** The month the open order book runs out, or null if it does not inside six months. */
  bookRunsOutIn: string | null
  /** What is left uncovered when it does. */
  uncoveredAtThatPoint: number
  /** Cost of staying open to that point, or to the end of the horizon. */
  costToThatPoint: number
  monthlyCost: number
  /** Where the crossing point sits, if the cumulative cost passes the balance. */
  crossoverMonth: string | null
  assumptions: ForecastAssumption[]
}

export const HORIZON_MONTHS = 6

function addMonths(period: string, count: number): string {
  const [year, month] = period.split('-').map(Number)
  const at = new Date(Date.UTC(year, month - 1 + count, 1))
  return at.toISOString().slice(0, 7)
}

/**
 * How fast the open book has been shipping, from the tracker's own dispatch
 * dates over the last twelve months. Not a target and not an estimate: it is the
 * observed rate.
 */
export function observedDispatchRate(tracker: PoTrackerT, today: string): number {
  const from = addMonths(today.slice(0, 7), -12)
  const dispatched = tracker.orders.filter(
    (order) => order.dispatched_date !== null && order.dispatched_date.slice(0, 7) >= from,
  )
  return dispatched.length === 0 ? 0 : round2(dispatched.length / 12)
}

/**
 * Orders per month, averaged over a window of the tracker's dispatch history.
 * Used for the two scenarios that assume Polyco keeps ordering.
 */
export function averageOrdersPerMonth(tracker: PoTrackerT, today: string, months: number): number {
  const from = addMonths(today.slice(0, 7), -months)
  const inWindow = tracker.orders.filter(
    (order) => order.dispatched_date !== null && order.dispatched_date.slice(0, 7) >= from,
  )
  return inWindow.length === 0 ? 0 : round2(inWindow.length / months)
}

export type ForecastInput = {
  ledger: LedgerT
  tracker: PoTrackerT
  statements: StatementsT
  scenario: ScenarioKey
  /** Only used by `order-by-order`. Value of new orders per month. */
  monthlyOrderValue?: number
  today: string
}

export function forecast(input: ForecastInput): Forecast {
  const { ledger, tracker, statements, scenario, today } = input

  const balanceSeries = advanceBalanceSeries(ledger)
  const startingBalance = balanceSeries[balanceSeries.length - 1]?.balance ?? 0
  const openBook = orderCover(ledger)
  const monthlyCost = recurringMonthlyCost(latestStatement(statements)).total

  // The open book ships at the rate the tracker has actually been dispatching.
  const ordersPerMonth = observedDispatchRate(tracker, today)
  const openOrders = tracker.orders.filter((order) => order.dispatched_date === null).length
  const monthsToClear = ordersPerMonth > 0 ? openOrders / ordersPerMonth : Number.POSITIVE_INFINITY
  const shippingPerMonth = monthsToClear > 0 && Number.isFinite(monthsToClear)
    ? round2(openBook / monthsToClear)
    : 0

  /**
   * New orders per month under each scenario. The value of an order is not in
   * `po_data`, so a rate of orders is converted at the average value of the open
   * book. That is an assumption, and it is named on the page.
   */
  const averageOrderValue = openOrders > 0 ? round2(openBook / openOrders) : 0
  const newPerMonth =
    scenario === 'current-book'
      ? 0
      : scenario === 'last-twelve'
        ? round2(averageOrdersPerMonth(tracker, today, 12) * averageOrderValue)
        : (input.monthlyOrderValue ??
           round2(averageOrdersPerMonth(tracker, today, 3) * averageOrderValue))

  const months: ForecastMonth[] = []
  let balance = startingBalance
  let remainingBook = openBook
  let cumulativeCost = 0
  let runsOut: string | null = null
  let crossover: string | null = null

  for (let i = 1; i <= HORIZON_MONTHS; i++) {
    const period = addMonths(today.slice(0, 7), i)
    const shipping = Math.min(remainingBook, shippingPerMonth)

    remainingBook = round2(remainingBook - shipping)
    // Shipping works the advance off; new orders add to what is owed in goods.
    balance = round2(balance - shipping + newPerMonth)
    cumulativeCost = round2(cumulativeCost + monthlyCost)

    const exhausted = remainingBook <= 0
    if (exhausted && runsOut === null) runsOut = period
    if (crossover === null && cumulativeCost >= balance) crossover = period

    months.push({
      period,
      shipping,
      newOrders: newPerMonth,
      balance,
      cumulativeCost,
      bookExhausted: exhausted,
    })
  }

  const atRunOut = runsOut ? months.find((m) => m.period === runsOut)! : months[months.length - 1]

  return {
    scenario,
    months,
    bookRunsOutIn: runsOut,
    uncoveredAtThatPoint: atRunOut.balance,
    costToThatPoint: atRunOut.cumulativeCost,
    monthlyCost,
    crossoverMonth: crossover,
    assumptions: [
      {
        label: 'Advance balance today',
        value: String(startingBalance),
        source: 'Statement ledger, dated entries',
      },
      {
        label: 'Open order book',
        value: String(openBook),
        source: 'Ledger summary: pending POs and containers ready or in process',
      },
      {
        label: 'Cost of staying open',
        value: String(monthlyCost),
        source: `Recurring lines of the ${latestStatement(statements).id} funding statement`,
      },
      {
        label: 'Dispatch rate',
        value: `${ordersPerMonth} orders a month`,
        source: 'Tracker dispatch dates, last twelve months',
      },
      {
        label: 'Average order value',
        value: String(averageOrderValue),
        source: 'Open book divided by open orders. An assumption: po_data carries no order value.',
      },
      {
        label: 'Uncovered advance today',
        value: String(uncoveredAdvance(ledger)),
        source: 'Tab 1',
      },
    ],
  }
}
