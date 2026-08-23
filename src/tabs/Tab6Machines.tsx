import { Factory } from 'lucide-react'
import {
  CartesianGrid, Line, LineChart, ReferenceDot, ReferenceLine, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts'
import Gantt from '../components/Gantt'
import ScheduleReconciliation from '../components/ScheduleReconciliation'
import { machineFinding } from '../lib/engine/findings'
import { floorBreachMonth, monthlyMachineCount } from '../lib/engine/machines'
import type { LedgerT, MachineScheduleT, PoTrackerT } from '../lib/schema'
import { AXIS_TICK, CHART, NO_ANIMATION, TOOLTIP_STYLE } from '../lib/chart'
import { dateProse, monthProse, monthTable } from '../lib/format'
import { BlockHead, Card, CardBody, CardHead, Figures, Finding, Tile } from '../components/ui'

/**
 * What each machine is running, when it stops, and what that leaves.
 * CAPACITY-SPEC.
 *
 * The tab shows what runs and when. What it costs and what it produces is a
 * different tab and stays unbuilt until the output rates, headcount and
 * cases-per-container arrive: section 5 is explicit that none of it may be
 * estimated in the meantime.
 */
export default function Tab6Machines({
  schedule,
  ledger,
  tracker,
}: {
  schedule: MachineScheduleT
  ledger: LedgerT
  tracker: PoTrackerT
}) {
  const finding = machineFinding(schedule)
  const months = monthlyMachineCount(schedule)
  const breach = floorBreachMonth(schedule)
  const yearStart = `${schedule.horizon_end.slice(0, 4)}-01-01`

  const breachPoint = breach ? months.find((m) => m.period === breach) : undefined
  const stopping = schedule.machines.filter((machine) => !machine.continuous).length
  const atFloor = months.find((month) => month.count === schedule.viable_floor)

  return (
    <Card>
      <CardHead
        icon={<Factory size={20} className="text-leaf" aria-hidden />}
        kicker="Machine schedule"
        title="What runs, and when it stops"
        lede="Every machine here comes off because its purchase orders run out, not because a mould comes off or a decision has been taken."
        asAt={`Schedule as at ${dateProse(schedule.as_at)}`}
      />

      <CardBody>
      <Finding>{finding.sentence}</Finding>

      <Figures>
        <Tile
          label="Machines running today"
          value={String(finding.today)}
          sub={`Of ${schedule.machines.length} on the schedule`}
        />
        <Tile
          label={`Running at ${dateProse(yearStart)}`}
          value={String(finding.atYearStart)}
          sub={`Against a stated floor of ${schedule.viable_floor}`}
        />
        <Tile
          label="Falls below the floor"
          value={breach ? monthProse(breach) : 'Not within the schedule'}
          sub={
            breach
              ? `${months.find((m) => m.period === breach)!.count} machines, below ${schedule.viable_floor}`
              : `Stays at ${schedule.viable_floor} or above to ${monthProse(schedule.horizon_end.slice(0, 7))}`
          }
          tone={breach ? 'critical' : 'plain'}
        />
      </Figures>

      <div className="mt-8 border-t border-rule pt-6">
        {/* Every heading here states what the data says rather than naming the
            variable, and is assembled from the schedule so it cannot go stale. */}
        <BlockHead
          title={`${stopping} of ${schedule.machines.length} machines have a last day inside the schedule`}
          lede={`Each bar is a campaign. Pick one for the purchase orders behind it. ${schedule.horizon_note}`}
        />
        <Gantt schedule={schedule} ledger={ledger} />
      </div>

      <div className="mt-8 border-t border-rule pt-6">
        <BlockHead
          title={
            breach
              ? `${schedule.viable_floor} machines from ${monthProse(
                  atFloor?.period ?? breach,
                )}, and ${months[months.length - 1].count} from ${monthProse(breach)}`
              : `The count holds at or above ${schedule.viable_floor}`
          }
          lede={
            breach
              ? 'Machines still running at the end of each month. The six month forecast puts the order book running out in the same month, from the ledger and the tracker rather than from the schedule. Two sources, different data.'
              : 'Machines still running at the end of each month.'
          }
        />

        <div className="h-[260px] -ml-2 sm:h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={months}
              margin={{ top: 16, right: 132, bottom: 8, left: 8 }}
            >
              <CartesianGrid stroke={CHART.grid} vertical={false} />
              <XAxis
                dataKey="period"
                tickFormatter={monthTable}
                tick={AXIS_TICK}
                stroke={CHART.grid}
              />
              <YAxis
                width={28}
                allowDecimals={false}
                domain={[0, schedule.machines.length]}
                tickCount={schedule.machines.length + 1}
                tick={AXIS_TICK}
                stroke={CHART.grid}
              />
              <Tooltip
                labelFormatter={(v) => monthProse(String(v))}
                formatter={(v: number) => [`${v} machines`, 'Running at month end']}
                contentStyle={TOOLTIP_STYLE}
              />

              {/* The floor, in critical because falling below it is a shortfall
                  and section 3 keeps red for exactly that. */}
              <ReferenceLine
                y={schedule.viable_floor}
                stroke={CHART.critical}
                strokeDasharray="4 3"
                label={{
                  value: `${schedule.viable_floor} machine floor`,
                  position: 'right',
                  fill: CHART.critical,
                  fontSize: 11,
                }}
              />

              <Line
                dataKey="count"
                name="Machines running"
                type="stepAfter"
                stroke={CHART.accent}
                strokeWidth={2}
                dot={{ r: 2, fill: CHART.accent, stroke: 'none' }}
                {...NO_ANIMATION}
              />

              {breachPoint && (
                <ReferenceDot
                  x={breachPoint.period}
                  y={breachPoint.count}
                  r={3}
                  fill={CHART.critical}
                  stroke="none"
                  label={{
                    // Below, not right: the count runs flat to the edge of the
                    // schedule from here, and a label to the right of the dot
                    // sits on top of that line.
                    value: `Below the floor, ${monthTable(breachPoint.period)}`,
                    position: 'bottom',
                    fill: CHART.critical,
                    fontSize: 11,
                  }}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <ScheduleReconciliation schedule={schedule} ledger={ledger} tracker={tracker} />
      </CardBody>
    </Card>
  )
}
