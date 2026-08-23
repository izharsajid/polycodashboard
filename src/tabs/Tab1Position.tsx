import { Scale } from 'lucide-react'
import { useState } from 'react'
import {
  Area, CartesianGrid, ComposedChart, Line, ReferenceArea, ReferenceDot, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import type { LedgerT } from '../lib/schema'
import { cumulativeSeries, orderCover, uncoveredAdvance } from '../lib/engine'
import { advanceBalanceSeries } from '../lib/engine/statement'
import { positionFinding } from '../lib/engine/findings'
import { AXIS_TICK, CHART, GRID_COUNT, NO_ANIMATION, TOOLTIP_STYLE, axisMoney } from '../lib/chart'
import { money, moneyWhole } from '../lib/format'
import { BlockHead, Card, CardBody, CardHead, Figures, Finding, Tile, Working } from '../components/ui'

function monthLabel(iso: string) {
  const [y, m] = iso.split('-')
  return `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+m - 1]} ${y.slice(2)}`
}

/** Twelve months back from the last point in the series. */
const RECENT_MONTHS = 12

export default function Tab1Position({ ledger }: { ledger: LedgerT }) {
  const s = ledger.summary
  const advance = uncoveredAdvance(ledger)
  const cover = orderCover(ledger)
  const finding = positionFinding(ledger)
  const balance = advanceBalanceSeries(ledger)
  const [showAll, setShowAll] = useState(false)
  const [showComponents, setShowComponents] = useState(false)

  const asAt = new Date(s.as_at + 'T00:00:00Z').toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  })

  // The series runs from January 2023 and the part that matters is the recent
  // divergence, which is otherwise compressed into the right of the axis.
  const cutoff = new Date(balance[balance.length - 1].date + 'T00:00:00Z')
  cutoff.setUTCMonth(cutoff.getUTCMonth() - RECENT_MONTHS)
  const recent = balance.filter((p) => p.date >= cutoff.toISOString().slice(0, 10))
  const series = showAll ? balance : recent

  // One tick per month. The series is keyed on ledger dates, several of which can
  // land in the same month, and letting the axis pick its own ticks prints the
  // same month label twice, which reads as an error.
  const monthTicks: string[] = []
  const seenMonths = new Set<string>()
  for (const point of series) {
    const month = point.date.slice(0, 7)
    if (seenMonths.has(month)) continue
    seenMonths.add(month)
    monthTicks.push(point.date)
  }

  // The components toggle overlays the two cumulative lines the chart used to
  // draw, for anyone who wants to see where the balance comes from.
  const cumulative = cumulativeSeries(ledger)
  const byDate = new Map(cumulative.map((p) => [p.date, p]))
  const chartData = series.map((point) => ({
    date: point.date,
    balance: point.balance,
    received: byDate.get(point.date)?.receivedCumulative ?? null,
    delivered: byDate.get(point.date)?.deliveredCumulative ?? null,
  }))
  const lastPoint = series[series.length - 1]
  const uncovered = finding.uncovered

  const coverPct = Math.round((cover / advance) * 100)

  return (
    <Card>
      <CardHead
        icon={<Scale size={20} className="text-leaf" aria-hidden />}
        kicker="Polyco position"
        title="Where we stand"
        lede="What Polyco has paid, what has shipped against it, and what is left. US dollars."
        asAt={`As at ${asAt}`}
      />

      <CardBody>
      <Finding>{finding.sentence}</Finding>

      <Figures>
        <Tile
          label="Received from Polyco"
          value={moneyWhole(finding.received)}
          sub="Cumulative, all periods"
        />
        <Tile
          label="Value delivered"
          value={moneyWhole(finding.delivered)}
          sub="Goods shipped, including recharges"
        />
        <Tile
          label="Advance not yet covered"
          value={moneyWhole(finding.uncovered)}
          sub="After every open order and ready container ships"
          tone="critical"
        />
      </Figures>

      <div className="mt-8 border-t border-rule pt-6">
        <BlockHead
          title="The advance has grown because payment ran ahead of shipping"
          lede="What Polyco is holding with us, day by day. It rises when they pay and falls when goods ship. The band is where it lands once the open book has shipped."
          actions={
            <>
              <button type="button" onClick={() => setShowComponents((v) => !v)} className="btn-secondary">
                {showComponents ? 'Hide components' : 'Show components'}
              </button>
              <button type="button" onClick={() => setShowAll((v) => !v)} className="btn-secondary">
                {showAll ? 'Last 12 months' : 'Full history'}
              </button>
            </>
          }
        />

        <div className="h-[300px] -ml-2 sm:h-[360px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 16, right: 132, bottom: 8, left: 8 }}>
              <CartesianGrid stroke={CHART.grid} vertical={false} />
              <XAxis
                dataKey="date" tickFormatter={monthLabel} ticks={monthTicks} minTickGap={40}
                tick={AXIS_TICK} stroke={CHART.grid}
              />
              <YAxis
                tickFormatter={axisMoney} width={56} tickCount={GRID_COUNT}
                tick={AXIS_TICK} stroke={CHART.grid}
              />
              <Tooltip
                labelFormatter={(v) => monthLabel(String(v))}
                formatter={(v: number, n: string) => [money(v), n]}
                contentStyle={TOOLTIP_STYLE}
              />

              {/* Where the balance lands once every open order and ready container
                  ships. The distance from the line down to this band is the
                  uncovered advance, which is the finding. */}
              <ReferenceArea
                y1={0} y2={uncovered} fill={CHART.accent} fillOpacity={0.06}
                stroke={CHART.grid}
              />
              <ReferenceLine
                y={uncovered} stroke={CHART.accent} strokeDasharray="4 4"
                label={{
                  value: `Uncovered ${moneyWhole(uncovered)}`,
                  position: 'right', fill: CHART.axis, fontSize: 11,
                }}
              />

              {showComponents && (
                <Line
                  type="stepAfter" dataKey="received" name="Received, cumulative"
                  stroke={CHART.context} strokeWidth={1.5} strokeDasharray="2 3" dot={false}
                  {...NO_ANIMATION}
                />
              )}
              {showComponents && (
                <Line
                  type="stepAfter" dataKey="delivered" name="Delivered, cumulative"
                  stroke={CHART.context} strokeWidth={1.5} strokeDasharray="6 3" dot={false}
                  {...NO_ANIMATION}
                />
              )}

              <Area
                type="stepAfter" dataKey="balance" name="Advance balance"
                stroke={CHART.accent} strokeWidth={2} fill={CHART.accent} fillOpacity={0.1}
                {...NO_ANIMATION}
              />
              <ReferenceDot
                x={lastPoint.date} y={lastPoint.balance} r={3} fill={CHART.accent} stroke="none"
                label={{
                  value: moneyWhole(lastPoint.balance),
                  position: 'right', fill: CHART.accent, fontSize: 11, fontWeight: 600,
                }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <p className="lede mt-3">
          Open orders and finished containers cover {coverPct}% of the advance.
        </p>
      </div>

      <Working
        title="How the advance is covered"
        lede="The reconciliation behind the three figures above."
        defaultOpen
      >
        <div className="overflow-x-auto">
        <table className="w-full min-w-[17rem] text-table">
          <tbody>
            <Row label="Received from Polyco" value={s.total_received} />
            <Row label="Less: value delivered" value={-s.total_delivered} />
            <Row label="Advance held against future delivery" value={s.total_received - s.total_delivered} rule />
            <Row label="Less: open purchase orders" value={-s.pos_pending_to_deliver} />
            <Row label="Less: containers ready to load" value={-s.containers_ready_next_month} />
            <Row label="Less: containers in process" value={-s.containers_in_process_following_month} />
            <Row label="Advance not yet covered by an order" value={advance} rule strong />
          </tbody>
        </table>
        </div>
        <p className="lede mt-2">
          Cargo clearing and freight of {money(s.recharges_included_in_delivered)} sit inside
          delivered value and are not deducted twice.
        </p>
      </Working>
      </CardBody>
    </Card>
  )
}

function Row({
  label, value, rule, strong,
}: { label: string; value: number; rule?: boolean; strong?: boolean }) {
  return (
    <tr className={rule ? 'border-t border-rule' : undefined}>
      <td className={`py-1.5 pr-3 ${strong ? 'font-semibold text-ink-strong' : 'text-ink'}`}>
        {label}
      </td>
      <td
        className={`py-1.5 text-right num ${
          strong ? 'font-semibold text-ink-strong' : 'text-ink'
        }`}
      >
        {money(value)}
      </td>
    </tr>
  )
}
