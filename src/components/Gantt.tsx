import { Fragment, useState } from 'react'
import type { LedgerT, MachineRunT, MachineScheduleT, MachineT } from '../lib/schema'
import { campaignOrders, ganttWindow, spanIn } from '../lib/engine/machines'
import { dateTable, money, monthTable } from '../lib/format'

/**
 * The machine schedule as a Gantt. CAPACITY-SPEC section 3.
 *
 * Built by hand rather than in Recharts, which has no Gantt and would need a
 * stacked bar chart pretending to be one. Position is a percentage of the window
 * so the whole thing reflows on a narrow screen without recomputing anything.
 *
 * Two colours only: accent for a scheduled run, ink-30 for a mould change. A stop
 * is a terminus mark rather than a third colour.
 */
const MOULD_CHANGE_PX = 7

/**
 * A mould change takes hours and completes the same day, so it is drawn at a
 * fixed width in pixels rather than as a share of the window. Section 2 is
 * explicit that it must never consume days or read as a gap in production, and
 * anything scaled to the calendar here would be sub-pixel in a seven-month view
 * or days wide on a phone.
 */
function MouldChange({ leftPct, date }: { leftPct: number; date: string }) {
  return (
    <span
      className="absolute top-0 bottom-0 z-20 border-l border-r border-surface"
      style={{
        left: `calc(${leftPct}% - ${MOULD_CHANGE_PX / 2}px)`,
        width: MOULD_CHANGE_PX,
        // Hatched, so it reads as apparatus rather than as production, and stays
        // distinct from the run in greyscale.
        backgroundImage:
          'repeating-linear-gradient(45deg, #A8ADB3 0 2px, transparent 2px 4px)',
        backgroundColor: '#EFF1F2',
      }}
      title={`Mould change, ${dateTable(date)}. Hours, not days.`}
      aria-hidden
    />
  )
}

function RunBar({
  run,
  machine,
  schedule,
  onOpen,
  open,
}: {
  run: MachineRunT
  machine: MachineT
  schedule: MachineScheduleT
  onOpen: () => void
  open: boolean
}) {
  const window = ganttWindow(schedule)
  const { leftPct, widthPct } = spanIn(window, run.from, run.to)
  const continuous = run.toBasis === 'horizon'
  const estimated = run.toBasis === 'estimated' || run.fromBasis === 'estimated'

  return (
    <>
      {run.mouldChangeBefore && (
        <MouldChange leftPct={leftPct} date={run.mouldChangeBefore} />
      )}

      <button
        type="button"
        onClick={onOpen}
        aria-expanded={open}
        style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
        className={`absolute inset-y-1 z-10 flex items-center overflow-hidden rounded-sm px-1 text-left ${
          open ? 'ring-2 ring-ink ring-offset-1' : ''
        }`}
        title={`${machine.name}: ${run.product}`}
      >
        <span
          aria-hidden
          className="absolute inset-0"
          style={
            continuous
              ? // Section 3: an unbounded run drawn as a bounded bar is a lie, so
                // it fades out rather than ending in a terminus.
                { background: 'linear-gradient(to right, #2D5F3F 55%, rgba(45,95,63,0.08) 100%)' }
              : { background: '#2D5F3F' }
          }
        />
        <span className="relative truncate text-eyebrow font-medium text-white">
          {run.product}
        </span>
      </button>

      {/* A stop is a hard terminus. Not a colour, and not a fade. */}
      {!continuous && run.to === machine.stopDate && (
        <span
          className="absolute inset-y-0 z-20 w-[2px] bg-ink"
          style={{ left: `calc(${leftPct + widthPct}% - 1px)` }}
          aria-hidden
        />
      )}

      {estimated && (
        <span
          className="absolute inset-y-1 z-20 border-2 border-critical"
          style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
          aria-hidden
        />
      )}
    </>
  )
}

export default function Gantt({
  schedule,
  ledger,
}: {
  schedule: MachineScheduleT
  ledger: LedgerT
}) {
  const [open, setOpen] = useState<string | null>(null)
  const window = ganttWindow(schedule)

  return (
    <div>
      {/*
        One grid for the whole chart: machine, track, stop date. Today's rule is a
        grid item in the track column spanning every row, so it is positioned
        against the track itself rather than against the page minus two gutter
        widths. The first version did the arithmetic in a calc and used the narrow
        gutters at every breakpoint, which put today seventeen pixels off its own
        date on a wide screen.
      */}
      <div className="relative pb-4">
      <div className="grid grid-cols-[68px_1fr_74px] sm:grid-cols-[92px_1fr_96px]">
        <div className="border-b border-rule" />
        <div className="relative h-5 border-b border-rule">
          {window.months.map((month) => (
            <span
              key={month.period}
              className="absolute bottom-1 eyebrow"
              style={{ left: `${month.startPct}%` }}
            >
              {monthTable(month.period).slice(0, 3)}
            </span>
          ))}
        </div>
        <div className="border-b border-rule" />

        {schedule.machines.map((machine) => (
          <Fragment key={machine.id}>
            <div className="flex flex-col justify-center border-b border-rule-soft py-1 pr-1">
              <span className="text-label font-medium text-ink">{machine.id}</span>
              <span className="truncate text-eyebrow text-ink-50">
                {machine.status === 'mould_changing' ? 'Mould change' : 'Running'}
              </span>
            </div>

            <div className="relative h-9 border-b border-rule-soft">
              {/* Month gridlines. A vertical rule is the time axis on a Gantt
                  rather than decoration, which is why section 6's no-vertical-
                  gridlines rule does not apply here. */}
              {window.months.map((month) => (
                <span
                  key={month.period}
                  className="absolute inset-y-0 w-px bg-rule-soft"
                  style={{ left: `${month.startPct}%` }}
                  aria-hidden
                />
              ))}

              {machine.runs.map((run) => (
                <RunBar
                  key={`${machine.id}-${run.from}`}
                  run={run}
                  machine={machine}
                  schedule={schedule}
                  open={open === `${machine.id}-${run.from}`}
                  onOpen={() =>
                    setOpen((current) =>
                      current === `${machine.id}-${run.from}` ? null : `${machine.id}-${run.from}`,
                    )
                  }
                />
              ))}
            </div>

            {/* The stop date, or what a continuous machine is doing instead. */}
            <div className="flex items-center border-b border-rule-soft py-1 pl-1">
              {machine.continuous ? (
                <span className="text-eyebrow text-ink-50">One order a month</span>
              ) : (
                <span className="text-eyebrow font-medium text-ink">
                  {dateTable(machine.stopDate!)}
                </span>
              )}
            </div>
          </Fragment>
        ))}

      </div>

        {/*
          Today, over every row. A second grid on the same template rather than an
          item inside the first: an explicitly placed item spanning the track
          column pushes every auto-placed row out of that column, which took the
          chart apart. Overlaying it leaves the rows to flow normally and still
          measures today against the track and nothing else.
        */}
        <div
          className="pointer-events-none absolute inset-0 grid grid-cols-[68px_1fr_74px] sm:grid-cols-[92px_1fr_96px]"
          aria-hidden
        >
          <div />
          <div className="relative">
            <span
              className="absolute inset-y-0 bottom-4 z-30 w-px bg-ink"
              style={{ left: `${window.todayPct}%` }}
            />
            <span
              className="absolute bottom-0 z-30 -translate-x-1/2 text-eyebrow font-semibold text-ink"
              style={{ left: `${window.todayPct}%` }}
            >
              Today
            </span>
          </div>
          <div />
        </div>
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-label text-ink-50">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-4 rounded-sm bg-accent" /> Scheduled run
        </span>
        <span className="flex items-center gap-1">
          <span
            className="inline-block h-2 w-4"
            style={{
              backgroundImage:
                'repeating-linear-gradient(45deg, #A8ADB3 0 2px, transparent 2px 4px)',
              backgroundColor: '#EFF1F2',
            }}
          />
          Mould change, hours not days
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-[2px] bg-ink" /> Stops, and today
        </span>
      </div>

      {open && (
        <CampaignDetail
          schedule={schedule}
          ledger={ledger}
          id={open}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  )
}

/** The purchase orders on the campaign the reader picked, and their value. */
function CampaignDetail({
  schedule,
  ledger,
  id,
  onClose,
}: {
  schedule: MachineScheduleT
  ledger: LedgerT
  id: string
  onClose: () => void
}) {
  const machine = schedule.machines.find((m) => id.startsWith(`${m.id}-`))
  const run = machine?.runs.find((r) => id === `${machine.id}-${r.from}`)
  if (!machine || !run) return null

  const campaign = campaignOrders(schedule, machine.id, run, ledger)

  return (
    <div className="mt-3 border-l-2 border-accent pl-2">
      <div className="flex flex-wrap items-baseline justify-between gap-1">
        <p className="text-body font-medium text-ink">
          {machine.name}, {run.product}
        </p>
        <button type="button" onClick={onClose} className="btn-text no-print">
          Close
        </button>
      </div>
      <p className="lede">
        {run.fromBasis === 'in_progress' ? 'Running at ' : 'From '}
        {dateTable(run.from)}
        {run.toBasis === 'horizon'
          ? `, one order a month to ${dateTable(run.to)}, the edge of the schedule`
          : ` to ${dateTable(run.to)}`}
        {run.mouldChangeBefore && `, after a mould change on ${dateTable(run.mouldChangeBefore)}`}
      </p>

      <table className="mt-2 w-full max-w-2xl text-table">
        <thead>
          <tr className="border-b border-rule text-left">
            <th className="eyebrow py-1 pr-2">Purchase order</th>
            <th className="eyebrow py-1 pr-2 text-right">PO amount</th>
            <th className="eyebrow py-1">Basis</th>
          </tr>
        </thead>
        <tbody>
          {campaign.orders.map((order) => (
            <tr key={order.ref} className="border-b border-rule-soft align-top">
              <td className="py-1 pr-2 num text-ink">
                {order.ref}
                {order.sharedWith.length > 0 && (
                  <span className="text-label text-ink-50">
                    {' '}
                    also on {order.sharedWith.join(', ')}
                  </span>
                )}
              </td>
              <td className="py-1 pr-2 text-right num whitespace-nowrap">
                {order.value === null ? (
                  <span className="text-label text-ink-50">Not in the ledger</span>
                ) : (
                  <>
                    {money(order.value)}
                    {order.matchedOn === 'base' && (
                      <span className="text-label text-ink-50"> on base no.</span>
                    )}
                  </>
                )}
              </td>
              <td
                className={`py-1 text-label ${
                  order.basis === 'derived' ? 'text-critical' : 'text-ink-50'
                }`}
              >
                {order.basis === 'derived' ? 'Derived' : 'Confirmed'}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-rule">
            <td className="py-1 pr-2 text-label text-ink-70">
              {campaign.valued === 0
                ? `The ledger carries no value for any of these ${campaign.count}`
                : `${campaign.valued} of ${campaign.count} carry a value in the ledger`}
            </td>
            <td className="py-1 pr-2 text-right num font-medium">
              {/* Not $0.00. A campaign of four real orders totalling zero reads as
                  work worth nothing, when what it means is that the ledger does
                  not carry these orders yet. */}
              {campaign.valued === 0 ? (
                <span className="text-label font-normal text-ink-50">Not known</span>
              ) : (
                money(campaign.valuedTotal)
              )}
            </td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
