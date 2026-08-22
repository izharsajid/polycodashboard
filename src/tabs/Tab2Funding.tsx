import { useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import type { StatementsT, StatementT, ReconRowT } from '../lib/schema'
import {
  fundingSeries, statementMonths, latestStatement, recurringMonthlyCost,
  statementFoots, statementCoverage, round2, fmt,
} from '../lib/engine'
import { Tile, SectionHead, Note, Flag, Money } from '../components/ui'

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

const CONFIDENCE: Record<ReconRowT['match_confidence'], { label: string; cls: string }> = {
  confirmed: { label: 'Matched', cls: 'bg-leaf-wash text-leaf-deep' },
  probable: { label: 'Probable match', cls: 'bg-ember-wash text-ember' },
  partial: { label: 'Partially funded', cls: 'bg-alert-wash text-alert' },
  unmatched: { label: 'No matched receipt', cls: 'bg-alert-wash text-alert' },
}

function Confidence({ c }: { c: ReconRowT['match_confidence'] }) {
  const { label, cls } = CONFIDENCE[c]
  return (
    <span className={`inline-block whitespace-nowrap px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${cls}`}>
      {label}
    </span>
  )
}

function EstimateTag() {
  return (
    <span className="inline-block bg-ember-wash text-ember text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5">
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
  const monthNotes = statements.reconciliation_notes.filter((n) =>
    n.includes(monthName(current.id)),
  )

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
    ...actualsOnly.map(
      (s) => `${monthName(s.id)} has an actuals statement but no funding request.`,
    ),
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
        n="02"
        title="Monthly funding statements"
        lede={`Since ${monthName(months[0].id)} EcoFibre has issued Polyco a monthly Financial Overview
               setting out the funds required for the period, line by line, and Polyco has paid against it.
               This tab shows what was asked for, what it was for, what was paid, and the variance, month
               by month. All figures in US dollars. The latest statement covers to ${dateLong(latest.period_end)}.`}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-8">
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
          tone="alert"
          sub={`(${fmt(Math.abs(looseVariance))}) of it sits in the ${looseRows.length} periods with no or partial ledger match`}
        />
        <Tile
          label="Holding the operation open"
          value={fmt(recurring.total)}
          tone="ember"
          sub={`Recurring lines of the ${monthName(latest.id)} statement, per month`}
        />
      </div>

      <div className="mb-6 no-print overflow-x-auto">
        <div className="flex gap-1 border-b border-rule min-w-max" role="tablist" aria-label="Statement month">
          {months.map((m) => {
            const active = m.id === current.id
            return (
              <button
                key={m.id}
                role="tab"
                aria-selected={active}
                onClick={() => setSelected(m.id)}
                className={`px-3 py-2 text-sm whitespace-nowrap border-b-2 -mb-px flex items-center gap-1.5 ${
                  active ? 'border-leaf font-semibold' : 'border-transparent text-ink-muted hover:text-ink'
                }`}
              >
                {monthShort(m.id)}
                {!m.statement && <span className="h-1.5 w-1.5 bg-alert inline-block" aria-hidden />}
                {m.statement?.kind === 'actuals' && (
                  <span className="h-1.5 w-1.5 bg-ember inline-block" aria-hidden />
                )}
              </button>
            )
          })}
        </div>
        <p className="mt-1.5 text-[10px] text-ink-muted">
          Red mark: no statement exists for the month. Orange mark: actuals only, no funding request.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-3 mb-8">
        <div className="rulebox p-5 lg:col-span-2">
          {st ? (
            <>
              <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
                <h3 className="text-base font-semibold">{monthName(st.id)}</h3>
                <span className="eyebrow">{KIND_LABEL[st.kind]}</span>
              </div>
              <p className="text-xs text-ink-muted mb-4">
                Covers {dateLong(st.period_start)} to {dateLong(st.period_end)}
                {st.prepared_date
                  ? `, prepared ${dateLong(st.prepared_date)}`
                  : ', preparation date not recorded on the document'}
                . Reproduced line for line as issued.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b border-rule">
                      <th className="py-1.5 pr-4 font-semibold">Line as issued</th>
                      <th className="py-1.5 pr-4 font-semibold">Remarks</th>
                      <th className="py-1.5 text-right font-semibold">US$</th>
                    </tr>
                  </thead>
                  <tbody>
                    {st.lines.map((l, i) => (
                      <tr key={i} className="align-top border-b border-rule/60">
                        <td className="py-1.5 pr-4">{l.description}</td>
                        <td className="py-1.5 pr-4 text-xs text-ink-muted max-w-[18rem]">
                          {l.remarks ?? ''}
                        </td>
                        <td className="py-1.5 text-right whitespace-nowrap">
                          <Money n={l.amount} dp={2} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-rule-strong">
                      <td className="py-2 pr-4 font-semibold">Stated total</td>
                      <td />
                      <td className="py-2 text-right font-semibold whitespace-nowrap">
                        <Money n={st.stated_total} dp={2} />
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              {foot?.ok ? (
                <p className="mt-2 text-xs text-ink-muted">Foots to its own line items to the cent.</p>
              ) : (
                <div className="mt-2 flex items-center gap-2 text-xs">
                  <Flag>Does not foot</Flag>
                  <span>
                    Lines sum to <Money n={foot?.computed ?? 0} dp={2} /> against a stated total of{' '}
                    <Money n={st.stated_total} dp={2} />.
                  </span>
                </div>
              )}
              {st.notes.length > 0 && (
                <div className="mt-4 flex flex-col gap-2">
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
              <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
                <h3 className="text-base font-semibold">{monthName(current.id)}</h3>
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

        <div className="rulebox p-5">
          <h3 className="text-base font-semibold mb-1">Matched receipts</h3>
          <p className="text-xs text-ink-muted mb-4">From the Polyco ledger, for this period.</p>
          {rec ? (
            <>
              <div className="mb-3">
                <Confidence c={rec.match_confidence} />
              </div>
              <table className="w-full text-sm">
                <tbody>
                  <tr>
                    <td className="py-1.5 pr-4">Requested</td>
                    <td className="py-1.5 text-right align-top whitespace-nowrap">
                      <Money n={rec.requested} dp={2} />
                    </td>
                  </tr>
                  {rec.receipts.map((r, i) => (
                    <tr key={i}>
                      <td className="py-1.5 pr-4">
                        Received {dateLong(r.date)}
                        {r.note && <div className="text-xs text-ink-muted">{r.note}</div>}
                      </td>
                      <td className="py-1.5 text-right align-top whitespace-nowrap">
                        <Money n={r.amount} dp={2} />
                      </td>
                    </tr>
                  ))}
                  {rec.receipts.length === 0 && (
                    <tr>
                      <td className="py-1.5 pr-4 text-ink-muted" colSpan={2}>
                        No receipt in the ledger has been matched to this request.
                      </td>
                    </tr>
                  )}
                  <tr className="border-t border-rule">
                    <td className="py-1.5 pr-4">Received, total</td>
                    <td className="py-1.5 text-right whitespace-nowrap">
                      <Money n={rec.received_total} dp={2} />
                    </td>
                  </tr>
                  <tr className="border-t border-rule-strong">
                    <td className="py-2 pr-4 font-semibold">Received less requested</td>
                    <td className={`py-2 text-right font-semibold whitespace-nowrap ${varianceAlert ? 'text-alert' : ''}`}>
                      <Money n={rec.variance} dp={2} />
                    </td>
                  </tr>
                </tbody>
              </table>
              {monthNotes.length > 0 && (
                <div className="mt-4 flex flex-col gap-2">
                  {monthNotes.map((n, i) => (
                    <Note key={i} tone={/resolve|confirm/i.test(n) ? 'alert' : 'plain'}>
                      {n}
                    </Note>
                  ))}
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-ink-muted">
              No funding request exists for {monthName(current.id)}, so there is nothing to
              reconcile yet.
            </p>
          )}
        </div>
      </div>

      <div className="rulebox p-5 mb-8">
        <h3 className="text-base font-semibold mb-1">
          Since March 2026 Polyco has paid each statement within days, at or within roughly a
          thousand dollars of the request
        </h3>
        <p className="text-sm text-ink-muted mb-5 max-w-3xl leading-relaxed">
          Cumulative funds requested against cumulative funds received, across every statement
          period. The distance between the lines opens in the 2025 periods that have no or only a
          partial ledger match; the reconciliation notes below the table set out what is unresolved.
        </p>

        <div className="h-[320px] -ml-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
              <CartesianGrid stroke="#DDE3DF" vertical={false} />
              <XAxis
                dataKey="period" tickFormatter={monthShort} minTickGap={32}
                tick={{ fill: '#5C6B64', fontSize: 11 }} stroke="#B8C2BC"
              />
              <YAxis
                tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} width={56}
                tick={{ fill: '#5C6B64', fontSize: 11 }} stroke="#B8C2BC"
              />
              <Tooltip
                labelFormatter={(v) => monthName(String(v))}
                formatter={(v: number, n: string) => [fmt(v), n]}
                contentStyle={{
                  border: '1px solid #DDE3DF', borderRadius: 0, fontSize: 12,
                  fontFamily: '"IBM Plex Mono", monospace',
                }}
              />
              <Line
                type="stepAfter" dataKey="requestedCumulative" name="Requested"
                stroke="#14201B" strokeWidth={2} strokeDasharray="6 4" dot={false}
                isAnimationActive={false}
              />
              <Line
                type="stepAfter" dataKey="receivedCumulative" name="Received"
                stroke="#2F5C27" strokeWidth={2} dot={false} isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-ink-muted">
          <span className="flex items-center gap-2">
            <span className="w-5 border-t-2 border-dashed border-ink inline-block" /> Requested, cumulative
          </span>
          <span className="flex items-center gap-2">
            <span className="h-[2px] w-5 bg-leaf-deep inline-block" /> Received, cumulative
          </span>
        </div>
      </div>

      <div className="rulebox p-5 mb-8">
        <h3 className="text-base font-semibold mb-1">Month by month</h3>
        <p className="text-xs text-ink-muted mb-4">
          What was asked for, what was paid, and the variance. Select a row to open the statement
          above.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-rule">
                <th className="py-1.5 pr-4 font-semibold">Month</th>
                <th className="py-1.5 pr-4 font-semibold">Statement</th>
                <th className="py-1.5 pr-4 text-right font-semibold">Requested US$</th>
                <th className="py-1.5 pr-4 text-right font-semibold">Received US$</th>
                <th className="py-1.5 pr-4 text-right font-semibold">Received less requested</th>
                <th className="py-1.5 font-semibold">Ledger match</th>
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
                    className={`cursor-pointer border-b border-rule/60 ${
                      m.id === current.id ? 'bg-paper-panel' : 'hover:bg-paper-panel/60'
                    }`}
                  >
                    <td className="py-1.5 pr-4 whitespace-nowrap">{monthName(m.id)}</td>
                    <td className="py-1.5 pr-4 whitespace-nowrap">
                      {m.statement ? KIND_SHORT[m.statement.kind] : <Flag>None</Flag>}
                    </td>
                    <td className="py-1.5 pr-4 text-right whitespace-nowrap">
                      {m.recon && <Money n={m.recon.requested} dp={2} />}
                    </td>
                    <td className="py-1.5 pr-4 text-right whitespace-nowrap">
                      {m.recon && <Money n={m.recon.received_total} dp={2} />}
                    </td>
                    <td className={`py-1.5 pr-4 text-right whitespace-nowrap ${loose ? 'text-alert' : ''}`}>
                      {m.recon && <Money n={m.recon.variance} dp={2} />}
                    </td>
                    <td className="py-1.5">{m.recon && <Confidence c={m.recon.match_confidence} />}</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-rule-strong">
                <td className="py-2 pr-4 font-semibold">Total</td>
                <td />
                <td className="py-2 pr-4 text-right font-semibold whitespace-nowrap">
                  <Money n={lastPoint.requestedCumulative} dp={2} />
                </td>
                <td className="py-2 pr-4 text-right font-semibold whitespace-nowrap">
                  <Money n={lastPoint.receivedCumulative} dp={2} />
                </td>
                <td className="py-2 pr-4 text-right font-semibold whitespace-nowrap">
                  <Money n={shortfall} dp={2} />
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="mt-4 flex flex-col gap-2">
          {statements.reconciliation_notes.map((n, i) => (
            <Note key={i} tone={/resolve|confirm/i.test(n) ? 'alert' : 'plain'}>
              {n}
            </Note>
          ))}
        </div>
      </div>

      <div className="rulebox p-5 mb-8">
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
          <h3 className="text-base font-semibold">The monthly cost of holding the operation open</h3>
          <span className="eyebrow">Derived from the {monthName(latest.id)} statement</span>
        </div>
        <p className="text-sm text-ink-muted mb-5 max-w-3xl leading-relaxed">
          The recurring lines of the latest statement, excluding raw fibre containers, tooling and
          cargo clearance, insurance instalments and certification. This is what it costs each
          month to keep the plant staffed, housed and powered at the current configuration, and it
          is the figure a temporary shutdown is measured against. A shutdown carries its own
          holding, stop and restart costs; those are costed in the configurations tab once machine
          data arrives.
        </p>
        <div className="grid gap-5 lg:grid-cols-2">
          <div>
            <h4 className="eyebrow mb-2">Recurring lines</h4>
            <table className="w-full text-sm">
              <tbody>
                {recurring.lines.map((l, i) => (
                  <tr key={i}>
                    <td className="py-1.5 pr-4">{l.description}</td>
                    <td className="py-1.5 text-right whitespace-nowrap">
                      <Money n={l.amount} dp={2} />
                    </td>
                  </tr>
                ))}
                <tr className="border-t border-rule-strong">
                  <td className="py-2 pr-4 font-semibold">Recurring cost per month</td>
                  <td className="py-2 text-right font-semibold whitespace-nowrap">
                    <Money n={recurring.total} dp={2} />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div>
            <h4 className="eyebrow mb-2">How it is derived</h4>
            <table className="w-full text-sm">
              <tbody>
                <tr>
                  <td className="py-1.5 pr-4">Stated total, {monthName(latest.id)}</td>
                  <td className="py-1.5 text-right whitespace-nowrap">
                    <Money n={latest.stated_total} dp={2} />
                  </td>
                </tr>
                {recurring.excluded
                  .filter((l) => l.amount !== 0)
                  .map((l, i) => (
                    <tr key={i}>
                      <td className="py-1.5 pr-4">
                        {l.amount > 0 ? 'Less: ' : 'Add back: '}
                        {l.description}
                      </td>
                      <td className="py-1.5 text-right whitespace-nowrap">
                        <Money n={-l.amount} dp={2} />
                      </td>
                    </tr>
                  ))}
                <tr className="border-t border-rule-strong">
                  <td className="py-2 pr-4 font-semibold">Recurring cost per month</td>
                  <td className="py-2 text-right font-semibold whitespace-nowrap">
                    <Money n={recurring.total} dp={2} />
                  </td>
                </tr>
              </tbody>
            </table>
            <p className="mt-3 text-xs text-ink-muted leading-relaxed">
              Raw fibre containers move with output and are excluded. Insurance and certification
              are instalments of an annual cost, not a monthly one. The customs duty refund is a
              one-off credit and is added back.
            </p>
          </div>
        </div>
      </div>

      <div className="rulebox p-5 mb-8">
        <h3 className="text-base font-semibold mb-1">Capacity notes carried on the statements</h3>
        <p className="text-xs text-ink-muted mb-4">
          Quoted as written on the statements when issued. Each is an estimated input to the
          configuration model until confirmed against current headcount.
        </p>
        <div className="flex flex-col gap-3">
          {capacityNotes.map((c) => (
            <div key={c.text} className="flex flex-col gap-1 border-l-2 border-ember pl-3 py-1">
              <div className="flex flex-wrap items-center gap-2">
                <EstimateTag />
                <span className="eyebrow">{c.months.map(monthName).join(', ')}</span>
              </div>
              <p className="text-sm leading-relaxed">{c.text}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rulebox p-5">
        <h3 className="text-base font-semibold mb-1">Known gaps and exceptions</h3>
        <p className="text-xs text-ink-muted mb-4">
          Each renders as a flag rather than being quietly filled, and stays on this screen until
          the underlying document or confirmation arrives.
        </p>
        <div className="flex flex-col gap-2">
          {exceptions.map((e, i) => (
            <Note key={i} tone="alert">
              {e}
            </Note>
          ))}
        </div>
      </div>
    </section>
  )
}
