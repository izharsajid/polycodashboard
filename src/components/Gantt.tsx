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
 * Two colours only: leaf for a scheduled run, ink-muted for a mould change. A stop
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
          'repeating-linear-gradient(45deg, #6D7869 0 2px, transparent 2px 4px)',
        backgroundColor: '#EFF5EA',
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
        className={`absolute inset-y-1 z-10 flex items-center overflow-hidden px-1 text-left ${
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
                { background: 'linear-gradient(to right, #507A48 55%, rgba(80,122,72,0.08) 100%)' }
              : { background: '#507A48' }
          }
        />
        <span className="relative truncate text-sub font-semibold text-white">
          {run.product}
        </span>
      </button>

      {/* A stop is a hard terminus. Not a colour, and not a fade. */}
      {!continuous && run.to === machine.stopDate && (
        <span
          className="absolute inset-y-0 z-20 w-[2px] bg-ink-strong"
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
      {/*
        On a phone the track would be about two hundred pixels for seven months,
        which is proportionally honest and completely unreadable. The chart keeps
        its width and scrolls inside its own container instead, so the page never
        scrolls sideways and the time axis is never compressed to nothing.
      */}
      <div className="overflow-x-auto print:overflow-visible chart-print-grey">
      <div className="relative min-w-[620px] pb-5">
      <div className="grid grid-cols-[68px_1fr_74px] sm:grid-cols-[92px_1fr_96px]">
        <div className="sticky left-0 z-40 border-b border-rule bg-surface" />
        <div className="relative h-3 border-b border-rule">
          {window.months.map((month) => (
            <span
              key={month.period}
              className="absolute bottom-1 kicker"
              style={{ left: `${month.startPct}%` }}
            >
              {monthTable(month.period).slice(0, 3)}
            </span>
          ))}
        </div>
        <div className="border-b border-rule" />

        {schedule.machines.map((machine) => (
          <Fragment key={machine.id}>
            {/* Sticky inside the scroller: scrolling to February must not take
                the machine names with it, or the reader is looking at eight
                anonymous rows. */}
            <div className="sticky left-0 z-40 flex flex-col justify-center border-b border-rule bg-surface py-2 pr-2">
              <span className="text-table font-bold text-ink-strong">{machine.id}</span>
              <span className="truncate text-sub text-ink-muted">
                {machine.status === 'mould_changing' ? 'Mould change' : 'Running'}
              </span>
            </div>

            <div className="relative h-9 border-b border-rule print:break-inside-avoid">
              {/* Month gridlines. A vertical rule is the time axis on a Gantt
                  rather than decoration, which is why section 6's no-vertical-
                  gridlines rule does not apply here. */}
              {window.months.map((month) => (
                <span
                  key={month.period}
                  className="absolute inset-y-0 w-px bg-rule"
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
            <div className="flex items-center border-b border-rule py-2 pl-2">
              {machine.continuous ? (
                <span className="text-sub text-ink-muted">One order a month</span>
              ) : (
                <span className="text-sub font-bold text-ink-strong">
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
              className="absolute inset-y-0 bottom-5 z-30 w-px bg-ink-strong"
              style={{ left: `${window.todayPct}%` }}
            />
            <span
              className="absolute bottom-0 z-30 -translate-x-1/2 text-sub font-bold text-ink-strong"
              style={{ left: `${window.todayPct}%` }}
            >
              Today
            </span>
          </div>
          <div />
        </div>
      </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sub text-ink-muted">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-6 bg-leaf" /> Scheduled run
        </span>
        <span className="flex items-center gap-1">
          <span
            className="inline-block h-2.5 w-6"
            style={{
              backgroundImage:
                'repeating-linear-gradient(45deg, #6D7869 0 2px, transparent 2px 4px)',
              backgroundColor: '#EFF5EA',
            }}
          />
          Mould change, hours not days
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-4 w-[2px] bg-ink-strong" /> Stops, and today
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
    <div className="mt-4 rounded border-l-2 border-leaf bg-page py-3 pl-4 pr-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-figure font-bold text-leaf-deep">
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

      <table className="mt-3 w-full max-w-2xl text-table">
        <thead>
          <tr className="text-left">
            <th className="th rounded-l">Purchase order</th>
            <th className="th text-right">PO amount</th>
            <th className="th rounded-r">Basis</th>
          </tr>
        </thead>
        <tbody>
          {campaign.orders.map((order) => (
            <tr key={order.ref} className="border-b border-rule align-top">
              <td className="px-3 py-2 num text-ink">
                {order.ref}
                {order.sharedWith.length > 0 && (
                  <span className="text-sub text-ink-muted">
                    {' '}
                    also on {order.sharedWith.join(', ')}
                  </span>
                )}
              </td>
              <td className="px-3 py-2 text-right num whitespace-nowrap">
                {order.value === null ? (
                  <span className="text-sub text-ink-muted">Not in the ledger</span>
                ) : (
                  <>
                    {money(order.value)}
                    {order.matchedOn === 'base' && (
                      <span className="text-sub text-ink-muted"> on base no.</span>
                    )}
                  </>
                )}
              </td>
              <td
                className={`px-3 py-2 text-sub font-semibold ${
                  order.basis === 'derived' ? 'text-critical' : 'text-ink-muted'
                }`}
              >
                {order.basis === 'derived' ? 'Derived' : 'Confirmed'}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-rule">
            <td className="px-3 py-2 text-sub text-ink-muted">
              {campaign.valued === 0
                ? `The ledger carries no value for any of these ${campaign.count}`
                : `${campaign.valued} of ${campaign.count} carry a value in the ledger`}
            </td>
            <td className="px-3 py-2 text-right num font-bold text-ink-strong">
              {/* Not $0.00. A campaign of four real orders totalling zero reads as
                  work worth nothing, when what it means is that the ledger does
                  not carry these orders yet. */}
              {campaign.valued === 0 ? (
                <span className="text-sub font-normal text-ink-muted">Not known</span>
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
