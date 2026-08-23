import { TrendingDown } from 'lucide-react'
import { useMemo, useState } from 'react'
import {
  Area, CartesianGrid, ComposedChart, Line, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import type { LedgerT, PoTrackerT, StatementsT } from '../lib/schema'
import { forecast, type ScenarioKey } from '../lib/engine/forecast'
import { AXIS_TICK, CHART, GRID_COUNT, NO_ANIMATION, TOOLTIP_STYLE, axisMoney } from '../lib/chart'
import { money, moneyWhole, monthProse, monthTable } from '../lib/format'
import { BlockHead, Card, CardBody, CardHead, Figures, Finding, Tile } from '../components/ui'

const SCENARIOS: { key: ScenarioKey; label: string; sentence: string }[] = [
  {
    key: 'current-book',
    label: 'Current book only',
    sentence: 'Nothing new is ordered, and the open book ships at the rate it has been shipping.',
  },
  {
    key: 'last-twelve',
    label: 'At the 2025 rate',
    sentence: 'Polyco keeps ordering at the average of the last twelve months.',
  },
  {
    key: 'order-by-order',
    label: 'Order by order',
    sentence: 'Polyco orders at the rate of the last three months, which you can change.',
  },
]

export default function Tab5Forecast({
  ledger,
  tracker,
  statements,
  today,
}: {
  ledger: LedgerT
  tracker: PoTrackerT
  statements: StatementsT
  today: string
}) {
  const [scenario, setScenario] = useState<ScenarioKey>('current-book')
  const [monthlyOrderValue, setMonthlyOrderValue] = useState<number | undefined>(undefined)

  const result = useMemo(
    () => forecast({ ledger, tracker, statements, scenario, today, monthlyOrderValue }),
    [ledger, tracker, statements, scenario, today, monthlyOrderValue],
  )

  const chosen = SCENARIOS.find((s) => s.key === scenario)!

  const finding =
    result.bookRunsOutIn === null
      ? `The open book still has work in it six months out, with ${moneyWhole(result.uncoveredAtThatPoint)} of advance uncovered and ${moneyWhole(result.costToThatPoint)} spent staying open.`
      : `The open book runs out in ${monthProse(result.bookRunsOutIn)}, leaving ${moneyWhole(result.uncoveredAtThatPoint)} uncovered after ${moneyWhole(result.costToThatPoint)} of cost to stay open.`

  const chartData = result.months.map((m) => ({
    period: m.period,
    balance: m.balance,
    cost: m.cumulativeCost,
  }))
  const crossing = result.crossoverMonth
    ? chartData.find((d) => d.period === result.crossoverMonth)
    : undefined

  return (
    <Card>
      <CardHead
        icon={<TrendingDown size={20} className="text-leaf" aria-hidden />}
        kicker="Next six months"
        title="Where this goes"
        lede="The advance worked off against the cost of staying open. US dollars."
        asAt={`Projected from ${monthProse(today.slice(0, 7))}`}
      />

      <CardBody>
      <Finding>{finding}</Finding>

      <Figures>
        <Tile
          label="Open book runs out"
          value={result.bookRunsOutIn ? monthProse(result.bookRunsOutIn) : 'Not within six months'}
          sub="At the rate the tracker has been dispatching"
        />
        <Tile
          label="Uncovered at that point"
          value={moneyWhole(result.uncoveredAtThatPoint)}
          sub="Advance with no order left to work it off"
          tone="critical"
        />
        <Tile
          label="Cost of staying open to then"
          value={moneyWhole(result.costToThatPoint)}
          sub={`${moneyWhole(result.monthlyCost)} a month`}
        />
      </Figures>

      <div className="mt-8 border-t border-rule pt-6 flex flex-wrap items-center gap-2 no-print">
        {SCENARIOS.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => setScenario(option.key)}
            aria-pressed={scenario === option.key}
            className={
              scenario === option.key
                ? 'pill pill-active'
                : 'pill'
            }
          >
            {option.label}
          </button>
        ))}
        {scenario === 'order-by-order' && (
          <label className="ml-2 flex items-center gap-2 text-sub text-ink-muted">
            New orders a month
            <input
              type="number"
              step={10000}
              min={0}
              value={monthlyOrderValue ?? ''}
              placeholder={String(Math.round(result.months[0].newOrders))}
              onChange={(e) =>
                setMonthlyOrderValue(e.target.value === '' ? undefined : Number(e.target.value))
              }
              className="field w-32 py-1.5"
            />
          </label>
        )}
      </div>

      <p className="lede mt-2 max-w-prose">{chosen.sentence}</p>

      <div className="mt-3 h-[320px] -ml-2 sm:h-[360px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 16, right: 112, bottom: 8, left: 8 }}>
            <CartesianGrid stroke={CHART.grid} vertical={false} />
            <XAxis dataKey="period" tickFormatter={monthTable} tick={AXIS_TICK} stroke={CHART.grid} />
            <YAxis
              tickFormatter={axisMoney}
              width={64}
              tickCount={GRID_COUNT}
              tick={AXIS_TICK}
              stroke={CHART.grid}
            />
            <Tooltip
              labelFormatter={(v) => monthProse(String(v))}
              formatter={(v: number, n: string) => [money(v), n]}
              contentStyle={TOOLTIP_STYLE}
            />
            <Area
              dataKey="balance"
              name="Advance balance"
              stroke={CHART.accent}
              strokeWidth={2}
              fill={CHART.accent}
              fillOpacity={0.1}
              {...NO_ANIMATION}
            />
            <Line
              dataKey="cost"
              name="Cost of staying open"
              stroke={CHART.context}
              strokeWidth={2}
              strokeDasharray="6 3"
              dot={false}
              {...NO_ANIMATION}
            />
            {crossing && (
              <ReferenceDot
                x={crossing.period}
                y={crossing.cost}
                r={3}
                fill={CHART.critical}
                stroke="none"
                label={{
                  value: `Cost overtakes the advance, ${monthTable(crossing.period)}`,
                  position: 'right',
                  fill: CHART.critical,
                  fontSize: 11,
                }}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sub text-ink-muted">
        <span className="flex items-center gap-1">
          <span className="inline-block h-[2px] w-5 bg-leaf" /> Advance balance
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-5 border-t-2 border-dashed border-ink-muted" /> Cost of
          staying open, cumulative
        </span>
      </div>

      <div className="mt-8 border-t border-rule pt-6">
        <BlockHead title="What this rests on" />
        <table className="w-full max-w-prose text-table">
          <tbody>
            {result.assumptions.map((assumption) => (
              <tr key={assumption.label} className="border-b border-rule align-top">
                <td className="py-2 pr-3 text-ink">{assumption.label}</td>
                <td className="py-2 pr-3 text-right num whitespace-nowrap font-semibold text-ink-strong">
                  {/^[\d.]+$/.test(assumption.value)
                    ? money(Number(assumption.value))
                    : assumption.value}
                </td>
                <td
                  className={`py-2 text-sub ${
                    /assumption/i.test(assumption.source) ? 'text-critical' : 'text-ink-muted'
                  }`}
                >
                  {assumption.source}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="lede mt-3 max-w-prose">
          This tab needs no machine data. When that arrives it gains configuration
          scenarios.
        </p>
      </div>
      </CardBody>
    </Card>
  )
}
