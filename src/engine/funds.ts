/**
 * Every figure on the Funds Requested tab comes from here. No React.
 *
 * Reconcile to source: each statement's `stated_total` is the figure shown for
 * it, always. Its lines, less any income it sets against them, are summed only
 * to prove they agree, and a disagreement throws, because it would mean this
 * code is wrong, not the statement.
 */
import { monthLong, usdWhole } from '../lib/format'
import type { FundsRequestedT, StatementKindT } from './schema'

export type Line = { cents: number; description: string; remarks: string | null }

export type Statement = {
  id: string
  periodStart: string
  periodEnd: string
  kind: StatementKindT
  /** Requests and requests with actuals count; an actuals-only statement does not. */
  isRequest: boolean
  /** The lines added up: what the month costs. */
  costsCents: number
  /** Money received that the statement sets against those costs. */
  incomeCents: number
  /** The statement's own total: costs less income. What was asked of Polyco. */
  statedCents: number
  lines: Line[]
  income: Line[]
  notes: string[]
}

export type Model = {
  statements: Statement[]
  requests: Statement[]
  /** Statements that record actuals, shown but kept out of every request total. */
  excluded: Statement[]
  requestedCents: number
  requestCount: number
  averageCents: number
  recordEnd: string
  asAt: string
  headline: string
}

const toCents = (dollars: number) => Math.round(dollars * 100)
const sum = (lines: Line[]) => lines.reduce((total, l) => total + l.cents, 0)

export class StatementDoesNotFoot extends Error {}

function buildStatement(raw: FundsRequestedT['statements'][number]): Statement {
  const toLine = (l: { amount: number; description: string; remarks: string | null }): Line => ({
    cents: toCents(l.amount),
    description: l.description,
    remarks: l.remarks,
  })
  const lines = raw.lines.map(toLine)
  const income = raw.income.map(toLine)
  const costsCents = sum(lines)
  const incomeCents = sum(income)
  const statedCents = toCents(raw.stated_total)

  if (costsCents - incomeCents !== statedCents) {
    throw new StatementDoesNotFoot(
      `Statement ${raw.id}: lines ${costsCents} less income ${incomeCents} cents against a stated ${statedCents}.`,
    )
  }

  return {
    id: raw.id,
    periodStart: raw.period_start,
    periodEnd: raw.period_end,
    kind: raw.kind,
    isRequest: raw.kind !== 'actuals',
    costsCents,
    incomeCents,
    statedCents,
    lines,
    income,
    notes: raw.notes,
  }
}

export function buildModel(data: FundsRequestedT, asAt: string): Model {
  const statements = data.statements
    .map(buildStatement)
    .sort((a, b) => a.periodStart.localeCompare(b.periodStart) || a.id.localeCompare(b.id))

  const requests = statements.filter((s) => s.isRequest)
  const requestedCents = requests.reduce((total, s) => total + s.statedCents, 0)
  const requestCount = requests.length
  const averageCents = Math.round(requestedCents / requestCount)
  const recordEnd = statements.map((s) => s.periodEnd).sort().reverse()[0]
  const lastRequestEnd = requests.map((s) => s.periodEnd).sort().reverse()[0]

  return {
    statements,
    requests,
    excluded: statements.filter((s) => !s.isRequest),
    requestedCents,
    requestCount,
    averageCents,
    recordEnd,
    asAt,
    headline:
      `${requestCount} funding requests, ${monthLong(requests[0].periodStart)} to ` +
      `${monthLong(lastRequestEnd)}, averaging ${usdWhole(averageCents)} a month.`,
  }
}

export function kindLabel(kind: StatementKindT): string {
  return kind === 'request'
    ? 'Request'
    : kind === 'request_with_actuals'
      ? 'Request with actuals'
      : 'Actuals, not a request'
}
