import { useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import type { StatementsT, StatementT, ReconRowT } from '../lib/schema'
import {
  fundingSeries, statementMonths, latestStatement, recurringMonthlyCost,
  statementFoots, statementCoverage, round2, fmt,
} from '../lib/engine'
import { settlementFinding } from '../lib/engine/findings'
import { AXIS_TICK, CHART, GRID_COUNT, NO_ANIMATION, TOOLTIP_STYLE, axisMoney } from '../lib/chart'
import { Finding, Flag, Money, Note, SectionHead, Tile, Working } from '../components/ui'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function monthName(id: string) {
  const [y, m] = id.split('-')
  return `${MONTHS[+m - 1]} ${y}`
}

function monthShort(id: string) {
  const [y, m] = id.split('-')
  return `${MONTHS[+m - 1].slice(0, 3)} ${y.slice(2)}`
}

function dateLong(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${+d} ${MONTHS[+m - 1]} ${y}`
}

function rangeLong(range: string) {
  const [a, b] = range.split(' to ')
  return `${dateLong(a)} to ${dateLong(b)}`
}

const KIND_LABEL: Record<StatementT['kind'], string> = {
  request: 'Funding request',
  request_with_actuals: 'Funding request with actual utilisation',
  actuals: 'Actuals statement, not a funding request',
}

const KIND_SHORT: Record<StatementT['kind'], string> = {
  request: 'Request',
  request_with_actuals: 'Request with actuals',
  actuals: 'Actuals only',
}

/** efdashboard's .po-state: text on a wash, pill-shaped, at weight 800. */
const CONFIDENCE: Record<ReconRowT['match_confidence'], { label: string; cls: string }> = {
  confirmed: { label: 'Matched', cls: 'bg-accent-soft text-accent' },
  probable: { label: 'Probable match', cls: 'bg-rule-soft text-ink-70' },
  partial: { label: 'Partially funded', cls: 'bg-watch-soft text-watch' },
  unmatched: { label: 'No matched receipt', cls: 'bg-critical-soft text-critical' },
}

function Confidence({ c }: { c: ReconRowT['match_confidence'] }) {
  const { label, cls } = CONFIDENCE[c]
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-1 py-[3px] text-eyebrow font-semibold ${cls}`}>
      {label}
    </span>
  )
}

function EstimateTag() {
  return (
    <span className="inline-block rounded-full bg-watch-soft px-1 py-[3px] text-eyebrow font-semibold text-watch">
      Estimated
    </span>
  )
}

export default function Tab2Funding({ statements }: { statements: StatementsT }) {
  const months = statementMonths(statements)
  const series = fundingSeries(statements)
  const latest = latestStatement(statements)
  const recurring = recurringMonthlyCost(latest)
  const coverage = statementCoverage(statements)
  const finding = settlementFinding(statements)

  const [selected, setSelected] = useState(latest.id)
  const current = months.find((m) => m.id === selected) ?? months[months.length - 1]

  const lastPoint = series[series.length - 1]
  const shortfall = round2(lastPoint.receivedCumulative - lastPoint.requestedCumulative)
  const looseRows = statements.reconciliation_to_ledger.filter(
    (r) => r.match_confidence === 'unmatched' || r.match_confidence === 'partial',
  )
  const looseVariance = round2(looseRows.reduce((a, r) => a + r.variance, 0))

  const st = current.statement
  const rec = current.recon
  const foot = st ? statementFoots(st) : null
  const varianceAlert =
    rec !== null && (rec.match_confidence === 'unmatched' || rec.match_confidence === 'partial')
  const monthNotes = statements.reconciliation_notes.filter((n) => n.includes(monthName(current.id)))

  // Capacity notes carried on the statements, quoted verbatim with their months.
  const capacityNotes: { text: string; months: string[] }[] = []
  const addCapacityNote = (text: string, id: string) => {
    const hit = capacityNotes.find((c) => c.text === text)
    if (hit) hit.months.push(id)
    else capacityNotes.push({ text, months: [id] })
  }
  for (const s of statements.statements) {
    for (const n of s.notes) if (/\d[\s-]*machines/i.test(n)) addCapacityNote(n, s.id)
    for (const l of s.lines) {
      if (l.remarks && /\d[\s-]*machines/i.test(l.remarks)) addCapacityNote(l.remarks, s.id)
    }
  }

  const missingMonths = months.filter((m) => !m.statement)
  const actualsOnly = statements.statements.filter((s) => s.kind === 'actuals')
  const withActuals = statements.statements.filter((s) => s.kind !== 'request')
  const exceptions: string[] = [
    `No statement exists before ${monthName(months[0].id)}. If earlier periods were funded, the supporting documents have not been supplied.`,
    ...missingMonths.map(
      (m) =>
        `No statement has been prepared for ${monthName(m.id)}. The latest statement covers only to ${dateLong(latest.period_end)}.`,
    ),
    ...actualsOnly.map((s) => `${monthName(s.id)} has an actuals statement but no funding request.`),
    `Actual utilisation is shown only for ${withActuals.map((s) => monthName(s.id)).join(' and ')}. Every other month shows what was requested, never what was spent.`,
    ...coverage.gaps.map((g) => `No funding request covers ${rangeLong(g)}.`),
    ...coverage.overlaps.map((o) => `Two statements both cover ${rangeLong(o)}.`),
    ...statements.statements.flatMap((s) =>
      s.notes.filter((n) => /^EXCEPTION/.test(n)).map((n) => `${monthName(s.id)}: ${n}`),
    ),
  ]

  return (
    <section>
      <SectionHead
        kicker="Funding and settlement"
        title="Monthly funding statements"
        lede={`A monthly Financial Overview has been issued to Polyco since ${monthName(months[0].id)}, setting out the funds required line by line. All figures in US dollars.`}
        asAt={`Latest statement covers to ${dateLong(latest.period_end)}`}
      />

      {finding && <Finding>{finding.sentence}</Finding>}

      <div className="grid gap-2 sm:grid-cols-3">
        <Tile
          label="Funds requested"
          value={fmt(lastPoint.requestedCumulative)}
          sub={`${statements.statements.length} statements, ${monthName(months[0].id)} to ${monthName(latest.id)}`}
        />
        <Tile
          label="Received against statements"
          value={fmt(lastPoint.receivedCumulative)}
          sub="Ledger receipts matched to statement periods"
        />
        <Tile
          label="Received less requested"
          value={`(${fmt(Math.abs(shortfall))})`}
          tone="critical"
          sub={`(${fmt(Math.abs(looseVariance))}) of it sits in the ${looseRows.length} periods with no or partial ledger match`}
        />
      </div>

      <div className="mt-6">
        <div className="px-2 pt-2 pb-2">
          <h3 className="text-subtitle font-semibold text-accent">
            The gap opens in the 2025 periods, not the recent ones
          </h3>
          <p className="lede mt-1 max-w-2xl">
            Cumulative funds requested against cumulative funds received, every statement period.
          </p>

          <div className="mt-3 h-[280px] -ml-2 sm:h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
                <CartesianGrid stroke={CHART.grid} vertical={false} />
                <XAxis
                  dataKey="period" tickFormatter={monthShort} minTickGap={32}
                  tick={AXIS_TICK} stroke={CHART.grid}
                />
                <YAxis
                  tickFormatter={axisMoney} width={56} tickCount={GRID_COUNT}
                  tick={AXIS_TICK} stroke={CHART.grid}
                />
                <Tooltip
                  labelFormatter={(v) => monthName(String(v))}
                  formatter={(v: number, n: string) => [fmt(v), n]}
                  contentStyle={TOOLTIP_STYLE}
                />
                {/* Dashed against solid, so they stay apart on a monochrome printer. */}
                <Line
                  type="stepAfter" dataKey="requestedCumulative" name="Requested"
                  stroke={CHART.context} strokeWidth={2} strokeDasharray="6 4" dot={false}
                  {...NO_ANIMATION}
                />
                <Line
                  type="stepAfter" dataKey="receivedCumulative" name="Received"
                  stroke={CHART.context} strokeWidth={2} dot={false} {...NO_ANIMATION}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-label text-ink-70">
            <span className="flex items-center gap-1">
              <span className="w-5 border-t-2 border-dashed border-ink inline-block" /> Requested, cumulative
            </span>
            <span className="flex items-center gap-1">
              <span className="h-[2px] w-5 bg-accent inline-block" /> Received, cumulative
            </span>
          </div>
        </div>
      </div>

      {/* A different question from settlement, so it gets its own block rather than
          a fourth tile competing with the three above. */}
      <div className="mt-6">
        <div className="px-2 pt-2 pb-2">
          <p className="eyebrow">Cost of holding the operation open</p>
          <h3 className="mt-1 text-subtitle font-semibold text-accent">
            {fmt(recurring.total)} a month at the current configuration
          </h3>
          <p className="lede mt-1 max-w-3xl">
            The recurring lines of the {monthName(latest.id)} statement, excluding raw fibre
            containers, tooling and cargo clearance, insurance instalments and certification. This
            is the figure a temporary shutdown is measured against. A shutdown carries its own
            holding, stop and restart costs, which are costed in the configurations tab once
            machine data arrives.
          </p>

          <Working title="How that figure is derived" lede="Recurring lines, and the bridge back to the stated total.">
            <div className="grid gap-2 lg:grid-cols-2">
              <div>
                <h4 className="eyebrow mb-1">Recurring lines</h4>
                <div className="overflow-x-auto">
                <table className="w-full min-w-[20rem] text-table">
                  <tbody>
                    {recurring.lines.map((l, i) => (
                      <tr key={i}>
                        <td className="py-1 pr-2">{l.description}</td>
                        <td className="py-1 text-right whitespace-nowrap">
                          <Money n={l.amount} dp={2} />
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t border-rule">
                      <td className="py-1 pr-2 font-semibold text-ink">Recurring cost per month</td>
                      <td className="py-1 text-right font-semibold text-ink whitespace-nowrap">
                        <Money n={recurring.total} dp={2} />
                      </td>
                    </tr>
                  </tbody>
                </table>
                </div>
              </div>
              <div>
                <h4 className="eyebrow mb-1">How it is derived</h4>
                <div className="overflow-x-auto">
                <table className="w-full min-w-[20rem] text-table">
                  <tbody>
                    <tr>
                      <td className="py-1 pr-2">Stated total, {monthName(latest.id)}</td>
                      <td className="py-1 text-right whitespace-nowrap">
                        <Money n={latest.stated_total} dp={2} />
                      </td>
                    </tr>
                    {recurring.excluded
                      .filter((l) => l.amount !== 0)
                      .map((l, i) => (
                        <tr key={i}>
                          <td className="py-1 pr-2">
                            {l.amount > 0 ? 'Less: ' : 'Add back: '}
                            {l.description}
                          </td>
                          <td className="py-1 text-right whitespace-nowrap">
                            <Money n={-l.amount} dp={2} />
                          </td>
                        </tr>
                      ))}
                    <tr className="border-t border-rule">
                      <td className="py-1 pr-2 font-semibold text-ink">Recurring cost per month</td>
                      <td className="py-1 text-right font-semibold text-ink whitespace-nowrap">
                        <Money n={recurring.total} dp={2} />
                      </td>
                    </tr>
                  </tbody>
                </table>
                </div>
                <p className="lede mt-2">
                  Raw fibre containers move with output and are excluded. Insurance and
                  certification are instalments of an annual cost, not a monthly one. The customs
                  duty refund is a one-off credit and is added back.
                </p>
              </div>
            </div>
          </Working>
        </div>
      </div>

      <Working
        title="Month by month"
        lede="What was asked for, what was paid, and the variance. Select a row to open that statement."
        defaultOpen
      >
        <div className="overflow-x-auto">
          <table className="w-full text-table">
            <thead>
              <tr className="text-left border-b border-rule bg-rule-soft">
                <th className="py-2 px-2 text-eyebrow font-semibold uppercase text-ink-50">Month</th>
                <th className="py-2 px-2 text-eyebrow font-semibold uppercase text-ink-50">Statement</th>
                <th className="py-2 px-2 text-right text-eyebrow font-semibold uppercase text-ink-50">Requested US$</th>
                <th className="py-2 px-2 text-right text-eyebrow font-semibold uppercase text-ink-50">Received US$</th>
                <th className="py-2 px-2 text-right text-eyebrow font-semibold uppercase text-ink-50">Variance</th>
                <th className="py-2 px-2 text-eyebrow font-semibold uppercase text-ink-50">Ledger match</th>
              </tr>
            </thead>
            <tbody>
              {months.map((m) => {
                const loose =
                  m.recon !== null &&
                  (m.recon.match_confidence === 'unmatched' || m.recon.match_confidence === 'partial')
                return (
                  <tr
                    key={m.id}
                    onClick={() => setSelected(m.id)}
                    className={`cursor-pointer border-b border-rule ${
                      m.id === current.id ? 'bg-rule-soft' : 'hover:bg-rule'
                    }`}
                  >
                    <td className="py-2 px-2 whitespace-nowrap">{monthName(m.id)}</td>
                    <td className="py-2 px-2 whitespace-nowrap">
                      {m.statement ? KIND_SHORT[m.statement.kind] : <Flag>None</Flag>}
                    </td>
                    <td className="py-2 px-2 text-right whitespace-nowrap">
                      {m.recon && <Money n={m.recon.requested} dp={2} />}
                    </td>
                    <td className="py-2 px-2 text-right whitespace-nowrap">
                      {m.recon && <Money n={m.recon.received_total} dp={2} />}
                    </td>
                    <td className={`py-2 px-2 text-right whitespace-nowrap ${loose ? 'text-critical' : ''}`}>
                      {m.recon && <Money n={m.recon.variance} dp={2} />}
                    </td>
                    <td className="py-2 px-2">
                      {m.recon && <Confidence c={m.recon.match_confidence} />}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-rule">
                <td className="py-2 px-2 font-semibold text-ink">Total</td>
                <td />
                <td className="py-2 px-2 text-right font-semibold text-ink whitespace-nowrap">
                  <Money n={lastPoint.requestedCumulative} dp={2} />
                </td>
                <td className="py-2 px-2 text-right font-semibold text-ink whitespace-nowrap">
                  <Money n={lastPoint.receivedCumulative} dp={2} />
                </td>
                <td className="py-2 px-2 text-right font-semibold text-ink whitespace-nowrap">
                  <Money n={shortfall} dp={2} />
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="mt-2 flex flex-col gap-1">
          {statements.reconciliation_notes.map((n, i) => (
            <Note key={i} tone={/resolve|confirm/i.test(n) ? 'alert' : 'plain'}>
              {n}
            </Note>
          ))}
        </div>
      </Working>

      <Working
        title="The statements as issued, for reference"
        lede="Each Financial Overview reproduced line for line, with the receipts matched to it."
      >
        <div className="no-print overflow-x-auto">
          <div className="flex gap-1 border-b border-rule min-w-max" role="tablist" aria-label="Statement month">
            {months.map((m) => {
              const active = m.id === current.id
              return (
                <button
                  key={m.id}
                  role="tab"
                  aria-selected={active}
                  onClick={() => setSelected(m.id)}
                  className={`px-2 py-1 text-label whitespace-nowrap rounded -mb-px border border-b-0 flex items-center gap-1 ${
                    active
                      ? 'bg-surface border-rule font-medium text-accent'
                      : 'border-transparent text-ink-70 hover:text-ink'
                  }`}
                >
                  {monthShort(m.id)}
                  {!m.statement && <span className="h-1.5 w-1.5 rounded-full bg-critical inline-block" aria-hidden />}
                  {m.statement?.kind === 'actuals' && (
                    <span className="h-1.5 w-1.5 rounded-full bg-watch inline-block" aria-hidden />
                  )}
                </button>
              )
            })}
          </div>
          <p className="lede mt-1">
            Red mark: no statement exists for the month. Amber mark: actuals only, no funding request.
          </p>
        </div>

        <div className="grid gap-2 lg:grid-cols-3 mt-3">
          <div className="lg:col-span-2">
            {st ? (
              <>
                <div className="flex flex-wrap items-baseline justify-between gap-1 mb-1">
                  <h4 className="text-body font-semibold text-ink">{monthName(st.id)}</h4>
                  <span className="eyebrow">{KIND_LABEL[st.kind]}</span>
                </div>
                <p className="lede mb-2">
                  Covers {dateLong(st.period_start)} to {dateLong(st.period_end)}
                  {st.prepared_date
                    ? `, prepared ${dateLong(st.prepared_date)}`
                    : ', preparation date not recorded on the document'}
                  . Reproduced line for line as issued.
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-table">
                    <thead>
                      <tr className="text-left border-b border-rule bg-rule-soft">
                        <th className="py-2 px-2 text-eyebrow font-semibold uppercase text-ink-50">Line as issued</th>
                        <th className="py-2 px-2 text-eyebrow font-semibold uppercase text-ink-50">Remarks</th>
                        <th className="py-2 px-2 text-right text-eyebrow font-semibold uppercase text-ink-50">US$</th>
                      </tr>
                    </thead>
                    <tbody>
                      {st.lines.map((l, i) => (
                        <tr key={i} className="align-top border-b border-rule">
                          <td className="py-2 px-2">{l.description}</td>
                          <td className="py-2 px-2 text-ink-70 max-w-[18rem]">{l.remarks ?? ''}</td>
                          <td className="py-2 px-2 text-right whitespace-nowrap">
                            <Money n={l.amount} dp={2} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-rule">
                        <td className="py-2 px-2 font-semibold text-ink">Stated total</td>
                        <td />
                        <td className="py-2 px-2 text-right font-semibold text-ink whitespace-nowrap">
                          <Money n={st.stated_total} dp={2} />
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                {foot?.ok ? (
                  <p className="lede mt-1">Foots to its own line items to the cent.</p>
                ) : (
                  <div className="mt-1 flex items-center gap-1 text-table">
                    <Flag>Does not foot</Flag>
                    <span>
                      Lines sum to <Money n={foot?.computed ?? 0} dp={2} /> against a stated total of{' '}
                      <Money n={st.stated_total} dp={2} />.
                    </span>
                  </div>
                )}
                {st.notes.length > 0 && (
                  <div className="mt-2 flex flex-col gap-1">
                    {st.notes.map((n, i) => (
                      <Note key={i} tone={/^EXCEPTION/.test(n) ? 'alert' : 'plain'}>
                        {n}
                      </Note>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="flex flex-wrap items-baseline justify-between gap-1 mb-2">
                  <h4 className="text-body font-semibold text-ink">{monthName(current.id)}</h4>
                  <Flag>No statement</Flag>
                </div>
                <Note tone="alert">
                  No statement has been prepared for {monthName(current.id)}. The latest statement,{' '}
                  {monthName(latest.id)}, covers only to {dateLong(latest.period_end)}. This month
                  renders as a flag until the statement is supplied.
                </Note>
              </>
            )}
          </div>

          <div>
            <h4 className="text-body font-semibold text-ink mb-1">Matched receipts</h4>
            <p className="lede mb-2">From the Polyco ledger, for this period.</p>
            {rec ? (
              <>
                <div className="mb-2">
                  <Confidence c={rec.match_confidence} />
                </div>
                <div className="overflow-x-auto">
                <table className="w-full min-w-[18rem] text-table">
                  <tbody>
                    <tr>
                      <td className="py-1 pr-2">Requested</td>
                      <td className="py-1 text-right align-top whitespace-nowrap">
                        <Money n={rec.requested} dp={2} />
                      </td>
                    </tr>
                    {rec.receipts.map((r, i) => (
                      <tr key={i}>
                        <td className="py-1 pr-2">
                          Received {dateLong(r.date)}
                          {r.note && <div className="lede">{r.note}</div>}
                        </td>
                        <td className="py-1 text-right align-top whitespace-nowrap">
                          <Money n={r.amount} dp={2} />
                        </td>
                      </tr>
                    ))}
                    {rec.receipts.length === 0 && (
                      <tr>
                        <td className="py-1 pr-2 text-ink-70" colSpan={2}>
                          No receipt in the ledger has been matched to this request.
                        </td>
                      </tr>
                    )}
                    <tr className="border-t border-rule">
                      <td className="py-1 pr-2">Received, total</td>
                      <td className="py-1 text-right whitespace-nowrap">
                        <Money n={rec.received_total} dp={2} />
                      </td>
                    </tr>
                    <tr className="border-t border-rule">
                      <td className="py-1 pr-2 font-semibold text-ink">Received less requested</td>
                      <td className={`py-1 text-right font-semibold whitespace-nowrap ${varianceAlert ? 'text-critical' : 'text-ink'}`}>
                        <Money n={rec.variance} dp={2} />
                      </td>
                    </tr>
                  </tbody>
                </table>
                </div>
                {monthNotes.length > 0 && (
                  <div className="mt-2 flex flex-col gap-1">
                    {monthNotes.map((n, i) => (
                      <Note key={i} tone={/resolve|confirm/i.test(n) ? 'alert' : 'plain'}>
                        {n}
                      </Note>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p className="text-table text-ink-70">
                No funding request exists for {monthName(current.id)}, so there is nothing to
                reconcile yet.
              </p>
            )}
          </div>
        </div>
      </Working>

      {/* Every open item in one place, rather than scattered across fourteen months. */}
      <div className="mt-6 border-t border-rule pt-3">
        <div className="px-2 pt-2 pb-2">
          <p className="eyebrow">Open items</p>
          <h3 className="mt-1 text-subtitle font-semibold text-accent">
            What is missing, what conflicts, what is unmatched
          </h3>
          <p className="lede mt-1 max-w-3xl">
            {exceptions.length} open items. Each renders as a flag rather than being quietly
            filled, and stays here until the underlying document or confirmation arrives.
          </p>

          <div className="mt-3 flex flex-col gap-1">
            {exceptions.map((e, i) => (
              <Note key={i} tone="alert">
                {e}
              </Note>
            ))}
          </div>

          {capacityNotes.length > 0 && (
            <div className="mt-3 border-t border-rule pt-3">
              <h4 className="text-body font-semibold text-ink mb-1">
                Capacity notes carried on the statements
              </h4>
              <p className="lede mb-2">
                Quoted as written when issued. Each is an estimated input to the configuration
                model until confirmed against current headcount.
              </p>
              <div className="flex flex-col gap-2">
                {capacityNotes.map((c) => (
                  <div key={c.text} className="flex flex-col gap-1 border-l-2 border-watch pl-2 py-1">
                    <div className="flex flex-wrap items-center gap-1">
                      <EstimateTag />
                      <span className="eyebrow">{c.months.map(monthName).join(', ')}</span>
                    </div>
                    <p className="text-table leading-relaxed">{c.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
