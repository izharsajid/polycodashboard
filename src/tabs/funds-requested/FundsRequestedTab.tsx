import { useCallback, useMemo, useReducer, type ReactNode } from 'react'
import { CATEGORIES, CATEGORY_LABEL } from '../../engine/classify'
import {
  buildModel,
  mixFinding,
  recordFinding,
  statementName,
  trendFinding,
  type Model,
} from '../../engine/funds'
import type { FundsRequestedT } from '../../engine/schema'
import { useFundsData } from '../../data/useFundsData'
import { day, monthLong, range, usd } from '../../lib/format'
import CategoryTable from './CategoryTable'
import CategoryToggles from './CategoryToggles'
import Comparison from './Comparison'
import CoverageRail from './CoverageRail'
import RecordRegister from './RecordRegister'
import RequirementChart from './RequirementChart'
import StatementDetail from './StatementDetail'
import { initialSelection, selectionReducer } from './selection'

/**
 * Tab 1, Funds Requested. BRIEF-TAB1.
 *
 * Four questions, down the page in the order a Polyco director asks them:
 * what is the requirement and which way is it going, what is it spent on, what
 * did one statement ask for, and where is the record irregular. Nothing else.
 */
export default function FundsRequestedTab() {
  const funds = useFundsData()

  if (funds.status === 'loading') {
    return (
      <p className="mt-8 text-body text-press-2" aria-busy="true">
        Loading the statements.
      </p>
    )
  }
  if (funds.status === 'failed') {
    return (
      <p role="alert" className="mt-8 max-w-prose border-l-3 border-alert bg-sheet py-3 pl-4 pr-4 text-body text-alert">
        {funds.error}
      </p>
    )
  }
  return <FundsRequested data={funds.data} />
}

function FundsRequested({ data }: { data: FundsRequestedT }) {
  const model = useMemo(() => buildModel(data, __BUILD_DATE__), [data])
  return <Page model={model} source={data.source} />
}

function Page({ model, source }: { model: Model; source: string }) {
  const reducer = useMemo(() => selectionReducer(model), [model])
  const [state, dispatch] = useReducer(reducer, model, initialSelection)

  const selected = model.statements.find((s) => s.id === state.selectedId) ?? model.statements[0]
  const compare = model.statements.find((s) => s.id === state.compareId) ?? model.statements[0]
  const select = useCallback((id: string) => dispatch({ type: 'select', id }), [])

  const showStatement = useCallback((id: string) => {
    dispatch({ type: 'select', id })
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    document.getElementById('q3')?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
  }, [])

  const filtered = state.active.size < CATEGORIES.length
  const requestKinds = model.requests.length
  const actualsCount = model.excluded.length

  return (
    <div className="space-y-10 pt-6 print:space-y-5 print:pt-2">
      {/* ---- Title block: a drawing sheet's title block, not a hero ---- */}
      <header className="card border-t-3 border-t-press">
        <div className="grid gap-px bg-rule sm:grid-cols-[2fr_1fr_1fr]">
          <div className="bg-sheet px-4 py-4 sm:px-5">
            <h1 className="title text-title uppercase tracking-wide">Funds requested</h1>
            <p className="mt-2 text-table text-press-2">
              Financial Overview statements issued by Eco Fibre Bahrain W.L.L. to Polyco Healthline Ltd
            </p>
          </div>
          <dl className="bg-sheet px-4 py-4 text-table sm:px-5">
            <dt className="text-small text-press-2">Statements</dt>
            <dd className="font-semibold">
              {requestKinds} requests, {actualsCount} actuals
            </dd>
            <dt className="mt-2 text-small text-press-2">Record</dt>
            <dd>{range(model.recordStart, model.recordEnd)}</dd>
          </dl>
          <dl className="bg-sheet px-4 py-4 text-table sm:px-5">
            <dt className="text-small text-press-2">As at</dt>
            <dd className="font-semibold">{day(model.asAt)}</dd>
            <dt className="mt-2 text-small text-press-2">Record ends</dt>
            <dd>{day(model.recordEnd)}</dd>
          </dl>
        </div>
        <div className="border-t border-rule px-4 py-4 sm:px-5">
          <p className="max-w-[40ch] text-title font-semibold leading-snug sm:text-display sm:leading-tight print:max-w-none print:text-title">
            {model.headline}
          </p>
          <p className="mt-2 max-w-prose text-table text-press-2">
            {usd(model.requestedCents)} requested in total.{' '}
            {model.excluded
              .map((s) => `The ${statementName(s)} records ${usd(s.statedCents)} of actual spending and is not a request, so it is not in this total.`)
              .join(' ')}{' '}
            Figures in US$ as issued. Source: {source}.
          </p>
        </div>
      </header>

      {/* ---- Q1: the requirement and its direction ---- */}
      <section className="section" aria-labelledby="q1">
        <h2 id="q1" className="title">{trendFinding(model)}</h2>
        <p className="lede no-print mt-1 max-w-prose">
          Each column is one statement, stacked by what it asks for. Choose a column, or use the arrow keys, to
          see its lines below.
        </p>

        <div className="no-print mt-4">
          <CategoryToggles
            active={state.active}
            onToggle={(category) => dispatch({ type: 'toggle', category })}
            onShowAll={() => dispatch({ type: 'showAll' })}
          />
        </div>
        {filtered && (
          <p className="mt-2 text-table" role="status">
            Showing {state.active.size} of {CATEGORIES.length} categories. Column heights are the sum of the
            categories shown, not the stated totals.
          </p>
        )}
        <p className="print-only mt-2 text-small text-press-2">
          Categories shown: {filtered ? CATEGORIES.filter((c) => state.active.has(c)).map((c) => CATEGORY_LABEL[c]).join(', ') : 'all seven'}.
        </p>

        <figure className="mt-4 card px-3 pb-3 pt-4 sm:px-4 print:mt-2 print:pt-2">
          <div className="keep-together">
            <RequirementChart model={model} active={state.active} selectedId={selected.id} onSelect={select} />
            <div className="mt-5 border-t border-rule pt-3 print:mt-2">
              <p className="mb-1.5 text-small font-semibold">Coverage on the calendar</p>
              <CoverageRail model={model} selectedId={selected.id} onSelect={select} />
            </div>
          </div>
          <figcaption className="mt-3 grid gap-x-6 gap-y-1.5 border-t border-rule pt-3 text-small text-press-2 sm:grid-cols-2">
            <Key mark={<span className="inline-block h-3 w-3 bg-press" />}>Request: solid, stacked by category</Key>
            <Key
              mark={
                <span className="hatch-utilised inline-block h-3 w-3 bg-press" />
              }
            >
              Request with actuals: hatched where already utilised
            </Key>
            <Key mark={<span className="inline-block h-3 w-3 border-[1.5px] border-dashed border-press" />}>
              Actuals only: not a request, outside every total
            </Key>
            <Key mark={<span className="inline-block h-3 w-3 border-2 border-press bg-marking" />}>Selected statement</Key>
            <Key
              mark={
                <span className="hatch-gap inline-block h-3 w-3 border border-press-2" />
              }
            >
              No request covers these days
            </Key>
            <Key mark={<span className="hatch-overlap inline-block h-3 w-3 bg-press" />}>
              Claimed by two statements
            </Key>
            {model.irregular.length > 0 && (
              <p className="sm:col-span-2">
                <span className="text-press">*</span> Periods that are not their calendar month:{' '}
                {model.irregular.map((s) => `${monthLong(s.id)}, ${range(s.periodStart, s.periodEnd)}`).join('; ')}.
              </p>
            )}
          </figcaption>
        </figure>
      </section>

      {/* ---- Q2: what it is spent on ---- */}
      <section className="section page-break" aria-labelledby="q2">
        <h2 id="q2" className="title">{mixFinding(model)}</h2>
        <p className="lede mt-1 max-w-prose">
          Each category's share of the {model.requestCount} requests, what the selected statement asks for in it,
          and its line across the requests.
        </p>
        <div className="mt-4 card px-4 py-2 sm:px-5">
          <CategoryTable model={model} selected={selected} active={state.active} />
        </div>
      </section>

      {/* ---- Q3: one statement, line by line ---- */}
      <section className="section page-break scroll-mt-4" aria-labelledby="q3-title" id="q3">
        <h2 id="q3-title" className="title">
          What the {statementName(selected)} asks for, line by line
        </h2>
        <div className="mt-4 grid gap-6 lg:grid-cols-[7fr_5fr]">
          <div className="card px-4 py-5 sm:px-5">
            <StatementDetail model={model} statement={selected} onSelect={select} />
          </div>
          <div className="card px-4 py-5 sm:px-5">
            <Comparison
              model={model}
              selected={selected}
              compare={compare}
              onCompare={(id) => dispatch({ type: 'compare', id })}
            />
          </div>
        </div>
      </section>

      {/* ---- Q4: where the record is irregular ---- */}
      <section className="section" aria-labelledby="q4">
        <h2 id="q4" className="title">{recordFinding(model)}</h2>
        <p className="lede mt-1 max-w-prose">
          Counted from the first statement to the as-at date. Each finding opens the statement it concerns.
        </p>
        <div className="mt-4 card px-4 py-2 sm:px-5">
          <RecordRegister model={model} onSelect={showStatement} />
        </div>
      </section>
    </div>
  )
}

function Key({ mark, children }: { mark: ReactNode; children: ReactNode }) {
  return (
    <p className="flex items-center gap-2">
      <span aria-hidden className="inline-flex shrink-0" style={{ printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}>
        {mark}
      </span>
      {children}
    </p>
  )
}
