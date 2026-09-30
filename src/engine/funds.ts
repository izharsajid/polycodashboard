/**
 * Every figure on the Funds Requested tab comes from here. No React, no
 * formatting beyond the few sentences the page states as findings, which are
 * built here so they change when the numbers do.
 *
 * Reconcile to source: each statement's `stated_total` is the figure shown for
 * it, always. The lines are summed only to prove they agree, and a disagreement
 * throws, because it would mean this code is wrong, not the statement.
 */
import { monthLong, percent, range, usd, usdWhole } from '../lib/format'
import { CATEGORIES, CATEGORY_LABEL, classify, type Category } from './classify'
import { coversCalendarMonth, daysInclusive, fromDay, toDay } from './dates'
import type { FundsRequestedT, StatementKindT } from './schema'

export type Line = {
  /** Position on the statement as issued. */
  index: number
  cents: number
  description: string
  remarks: string | null
  category: Category
  /**
   * Only on a statement carrying actuals: `true` for a line marked "utilised",
   * `false` for "required". `null` everywhere else.
   */
  utilised: boolean | null
}

/** One stacked piece of a statement's column: a category, split by utilisation where the statement has it. */
export type Segment = { category: Category; utilised: boolean | null; cents: number }

export type Statement = {
  id: string
  periodStart: string
  periodEnd: string
  days: number
  /** False for the statements whose period is not the calendar month in their id. */
  matchesMonth: boolean
  prepared: string | null
  kind: StatementKindT
  /** Requests and requests with actuals count; an actuals-only statement does not. */
  isRequest: boolean
  statedCents: number
  lines: Line[]
  byCategory: Record<Category, number>
  segments: Segment[]
  notes: string[]
  /** Notes the source itself flags as an exception, shown as a warning on the statement. */
  flags: string[]
}

export type Gap = {
  start: string
  end: string
  days: number
  /** Why nothing covers it, in a sentence. */
  reason: string
  /** The statement a reader should look at for it. */
  statementId: string
}

export type Overlap = { start: string; end: string; days: number; statementIds: string[] }

export type CategoryTotal = {
  category: Category
  cents: number
  /** Share of the request total. The base is always shown beside it. */
  share: number
  /** This category's amount on every request, in order. */
  series: { statementId: string; cents: number }[]
}

export type Model = {
  statements: Statement[]
  requests: Statement[]
  requestedCents: number
  requestCount: number
  averageCents: number
  /** Everything issued, requests and actuals together. Used only to say what is excluded. */
  excluded: Statement[]
  categoryTotals: CategoryTotal[]
  recordStart: string
  recordEnd: string
  asAt: string
  gaps: Gap[]
  overlaps: Overlap[]
  undated: Statement[]
  irregular: Statement[]
  headline: string
}

const toCents = (dollars: number) => Math.round(dollars * 100)

const zeroByCategory = () =>
  Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Record<Category, number>

const FLAG = /^exception:\s*/i

export class StatementDoesNotFoot extends Error {}

function buildStatement(raw: FundsRequestedT['statements'][number]): Statement {
  const carriesActuals = raw.kind === 'request_with_actuals'
  const lines: Line[] = raw.lines.map((l, index) => ({
    index,
    cents: toCents(l.amount),
    description: l.description,
    remarks: l.remarks,
    category: classify(l.description),
    utilised: carriesActuals ? /^utilised$/i.test(l.remarks?.trim() ?? '') : null,
  }))

  const statedCents = toCents(raw.stated_total)
  const footed = lines.reduce((sum, l) => sum + l.cents, 0)
  if (footed !== statedCents) {
    throw new StatementDoesNotFoot(
      `Statement ${raw.id}: lines sum to ${footed} cents against a stated ${statedCents}.`,
    )
  }

  const byCategory = zeroByCategory()
  for (const l of lines) byCategory[l.category] += l.cents

  // Utilised before required within a category, so the hatched part of August's
  // column sits under the solid part, as it happened in time.
  const segments: Segment[] = []
  for (const category of CATEGORIES) {
    const splits: (boolean | null)[] = carriesActuals ? [true, false] : [null]
    for (const utilised of splits) {
      const cents = lines
        .filter((l) => l.category === category && l.utilised === utilised)
        .reduce((sum, l) => sum + l.cents, 0)
      if (cents !== 0) segments.push({ category, utilised, cents })
    }
  }

  return {
    id: raw.id,
    periodStart: raw.period_start,
    periodEnd: raw.period_end,
    days: daysInclusive(raw.period_start, raw.period_end),
    matchesMonth: coversCalendarMonth(raw.id, raw.period_start, raw.period_end),
    prepared: raw.prepared_date,
    kind: raw.kind,
    isRequest: raw.kind !== 'actuals',
    statedCents,
    lines,
    byCategory,
    segments,
    notes: raw.notes,
    flags: raw.notes.filter((n) => FLAG.test(n)).map((n) => n.replace(FLAG, '')),
  }
}

/**
 * Day-by-day coverage by requests, from the first request to the as-at date.
 * A day no request covers is a gap; a day two cover is an overlap.
 */
function coverage(statements: Statement[], requests: Statement[], recordEnd: string, asAt: string) {
  const first = Math.min(...requests.map((s) => toDay(s.periodStart)))
  const last = Math.max(toDay(asAt), toDay(recordEnd))

  const claims = (d: number) =>
    requests.filter((s) => toDay(s.periodStart) <= d && d <= toDay(s.periodEnd))

  type Run = { start: number; end: number; ids: string[] }
  const gapRuns: Run[] = []
  const overlapRuns: Run[] = []
  for (let d = first; d <= last; d++) {
    const ids = claims(d).map((s) => s.id)
    const target = ids.length === 0 ? gapRuns : ids.length > 1 ? overlapRuns : null
    if (!target) continue
    const prev = target[target.length - 1]
    if (prev && prev.end === d - 1 && prev.ids.join() === ids.join()) prev.end = d
    else target.push({ start: d, end: d, ids })
  }

  const gaps: Gap[] = gapRuns.map((run) => {
    const start = fromDay(run.start)
    const end = fromDay(run.end)
    const actuals = statements.find(
      (s) => !s.isRequest && toDay(s.periodStart) <= run.start && run.end <= toDay(s.periodEnd),
    )
    const next = requests.find((s) => toDay(s.periodStart) === run.end + 1)
    const previous = [...requests].reverse().find((s) => toDay(s.periodEnd) === run.start - 1)

    if (actuals) {
      return {
        start, end, days: run.end - run.start + 1, statementId: actuals.id,
        reason: `Only the ${monthLong(actuals.id)} statement covers these days, and it records actual spending after the fact, not a request.`,
      }
    }
    if (run.start > toDay(recordEnd)) {
      return {
        start, end, days: run.end - run.start + 1, statementId: previous?.id ?? requests[requests.length - 1].id,
        reason: `No statement has been issued since the record ends on ${range(recordEnd, recordEnd)}.`,
      }
    }
    if (next) {
      return {
        start, end, days: run.end - run.start + 1, statementId: next.id,
        reason: `The ${monthLong(next.id)} statement starts on ${range(next.periodStart, next.periodStart)}.`,
      }
    }
    return {
      start, end, days: run.end - run.start + 1, statementId: previous?.id ?? requests[0].id,
      reason: previous
        ? `The ${monthLong(previous.id)} statement ends on ${range(previous.periodEnd, previous.periodEnd)}, and no statement starts until later.`
        : 'No statement covers these days.',
    }
  })

  const overlaps: Overlap[] = overlapRuns.map((run) => ({
    start: fromDay(run.start),
    end: fromDay(run.end),
    days: run.end - run.start + 1,
    statementIds: run.ids,
  }))

  return { gaps, overlaps }
}

export function buildModel(data: FundsRequestedT, asAt: string): Model {
  const statements = data.statements
    .map(buildStatement)
    .sort((a, b) => a.periodStart.localeCompare(b.periodStart) || a.id.localeCompare(b.id))

  const requests = statements.filter((s) => s.isRequest)
  const excluded = statements.filter((s) => !s.isRequest)
  const requestedCents = requests.reduce((sum, s) => sum + s.statedCents, 0)
  const requestCount = requests.length
  const averageCents = Math.round(requestedCents / requestCount)

  const categoryTotals: CategoryTotal[] = CATEGORIES.map((category) => {
    const cents = requests.reduce((sum, s) => sum + s.byCategory[category], 0)
    return {
      category,
      cents,
      share: cents / requestedCents,
      series: requests.map((s) => ({ statementId: s.id, cents: s.byCategory[category] })),
    }
  }).sort((a, b) => b.cents - a.cents)

  const recordStart = statements.map((s) => s.periodStart).sort()[0]
  const recordEnd = statements.map((s) => s.periodEnd).sort().reverse()[0]
  const { gaps, overlaps } = coverage(statements, requests, recordEnd, asAt)

  const firstRequest = requests[0]
  const lastRequestEnd = requests.map((s) => s.periodEnd).sort().reverse()[0]

  return {
    statements,
    requests,
    requestedCents,
    requestCount,
    averageCents,
    excluded,
    categoryTotals,
    recordStart,
    recordEnd,
    asAt,
    gaps,
    overlaps,
    undated: statements.filter((s) => s.prepared === null),
    irregular: statements.filter((s) => !s.matchesMonth),
    headline:
      `${requestCount} funding requests, ${monthLong(firstRequest.periodStart)} to ` +
      `${monthLong(lastRequestEnd)}, averaging ${usdWhole(averageCents)} a month.`,
  }
}

/* ---- Derived views the page asks for --------------------------------- */

/** A statement's total over the categories currently switched on. */
export function shownCents(s: Statement, active: ReadonlySet<Category>): number {
  return CATEGORIES.filter((c) => active.has(c)).reduce((sum, c) => sum + s.byCategory[c], 0)
}

export type BridgeStep = { category: Category; fromCents: number; toCents: number; deltaCents: number }

export type Bridge = {
  from: Statement
  to: Statement
  steps: BridgeStep[]
  unchanged: Category[]
  deltaCents: number
}

/** The movement from one statement to another, by category, largest movers first. */
export function bridge(from: Statement, to: Statement): Bridge {
  const all = CATEGORIES.map((category) => ({
    category,
    fromCents: from.byCategory[category],
    toCents: to.byCategory[category],
    deltaCents: to.byCategory[category] - from.byCategory[category],
  }))
  const steps = all
    .filter((s) => s.deltaCents !== 0)
    .sort((a, b) => Math.abs(b.deltaCents) - Math.abs(a.deltaCents) || CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category))
  return {
    from,
    to,
    steps,
    unchanged: all.filter((s) => s.deltaCents === 0).map((s) => s.category),
    deltaCents: to.statedCents - from.statedCents,
  }
}

/** The statement before this one in time, for the default comparison. */
export function previousStatement(model: Model, id: string): Statement | null {
  const at = model.statements.findIndex((s) => s.id === id)
  return at > 0 ? model.statements[at - 1] : null
}

/** A statement's name, with its real dates wherever the period is not its month. */
export function statementName(s: Statement): string {
  return s.matchesMonth
    ? `${monthLong(s.id)} statement`
    : `${monthLong(s.id)} statement, ${range(s.periodStart, s.periodEnd)}`
}

export function kindLabel(kind: StatementKindT): string {
  return kind === 'request'
    ? 'Request'
    : kind === 'request_with_actuals'
      ? 'Request with actuals'
      : 'Actuals, not a request'
}

/* ---- Findings the section headings state ------------------------------ */

export function trendFinding(model: Model): string {
  const latest = model.requests[model.requests.length - 1]
  const relation =
    latest.statedCents === model.averageCents
      ? 'level with'
      : latest.statedCents < model.averageCents
        ? 'below'
        : 'above'
  return (
    `The latest request, ${range(latest.periodStart, latest.periodEnd)}, is ${usd(latest.statedCents)}, ` +
    `${relation} the ${model.requestCount}-request average of ${usd(model.averageCents)}`
  )
}

export function mixFinding(model: Model): string {
  const top = model.categoryTotals[0]
  return (
    `${CATEGORY_LABEL[top.category]} is the largest share of the ${usd(model.requestedCents)} ` +
    `requested, at ${percent(top.share)}`
  )
}

export function recordFinding(model: Model): string {
  const n = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`
  return (
    `The record has ${n(model.gaps.length, 'gap', 'gaps')}, ${n(model.overlaps.length, 'overlap', 'overlaps')} ` +
    `and ${n(model.undated.length, 'statement', 'statements')} without a prepared date`
  )
}
