import { AlertTriangle, Factory, Layers, Scissors, ScanLine, Wrench, type LucideIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import MachineArt, { FAMILY_BG, FAMILY_LABEL } from '../../components/machines/MachineArt'
import StatePill from '../../components/StatePill'
import { MachinesPayload } from '../../data/schemas'
import { useApiData } from '../../data/useApiData'
import { useTracker } from '../../data/useTracker'
import { buildMachines, inMonth, monthSpan, timeline, withoutPo, type Family, type MachineType } from '../../engine/machines'
import type { TrackerPo } from '../../engine/tracker'
import { day, dayMonth, monthLong, monthOnly } from '../../lib/format'
import Gantt, { NO_PO_STRIPES } from './Gantt'
import MachineCard from './MachineCard'
import NoPoPanel from './NoPoPanel'
import TodayBoard from './TodayBoard'

/**
 * The machines, from the production and finishing plans: where each stands
 * today, a Gantt chart of when every machine runs until, the work planned
 * without a PO, then each machine in turn with the orders it is making.
 */
const SECTIONS: { type: MachineType; title: string; Icon: LucideIcon }[] = [
  { type: 'forming', title: 'Thermoforming', Icon: Factory },
  { type: 'lamination', title: 'Lamination', Icon: Layers },
  { type: 'trimming', title: 'Trimming', Icon: Scissors },
  { type: 'xray', title: 'X-ray', Icon: ScanLine },
]

/** Today in Bahrain, as YYYY-MM-DD. */
const todayIso = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bahrain' })

export default function MachinesTab() {
  const plan = useApiData('/api/machines', MachinesPayload, 'machine plan')
  const { tracker, error, loading } = useTracker()
  const model = useMemo(
    () => (plan.status === 'ready' ? buildMachines(plan.data.plan, tracker) : null),
    [plan, tracker],
  )
  /** The Gantt chart's view: every month at once, or one month (`YYYY-MM`). */
  const [view, setView] = useState<'all' | string>('all')

  if (plan.status === 'loading' || loading) return <p className="mt-8 text-body text-press-2" aria-busy="true">Loading the machines.</p>
  if (plan.status === 'failed' || !model) {
    return (
      <p role="alert" className="mt-8 max-w-prose rounded-card border-l-3 border-alert bg-sheet py-3 pl-4 pr-4 text-body text-alert">
        {plan.status === 'failed' ? plan.error : 'The machine plan could not be read.'}
      </p>
    )
  }

  const today = todayIso()
  const groups = SECTIONS.map((s) => ({ ...s, machines: model.machines.filter((m) => m.type === s.type) })).filter((g) => g.machines.length)
  const board = [
    { title: 'Thermoforming', Icon: Factory, machines: model.machines.filter((m) => m.type === 'forming') },
    { title: 'Finishing', Icon: Layers, machines: model.machines.filter((m) => m.type !== 'forming') },
  ].filter((g) => g.machines.length)
  const families = [...new Set(model.machines.flatMap((m) => timeline(m, model.range).map((b) => b.family)))] as Family[]
  const noPo = withoutPo(model.machines, today)
  const month = view === 'all' ? null : view
  const runningIn = (m: string) => model.machines.filter((x) => inMonth(x, m).running)
  const stopsIn = (m: string) => model.machines.filter((x) => x.stops?.startsWith(m)).sort((a, b) => a.stops!.localeCompare(b.stops!))

  return (
    <div className="space-y-8 pt-6">
      <header>
        <h1 className="condensed text-figure font-bold">Machines</h1>
        <p className="mt-1 max-w-prose text-table text-press-2">
          What every machine is running and until when, from the production and finishing plans of {day(model.asAt)}.
          Each PO's status comes live from efdashboard.com.
          {error && ` efdashboard.com could not be read just now (${error}), so the POs show without a status.`}
        </p>
      </header>

      <TodayBoard groups={board} today={today} />

      <section aria-labelledby="gantt" className="rounded-card bg-sheet p-4 shadow-card sm:p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 id="gantt" className="text-title font-bold">When each machine runs until</h2>
          <p className="text-small text-press-2">Hover or tap a bar for the product, dates and POs</p>
        </div>
        <ul className="mb-4 mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-small text-press-2" aria-label="Key">
          {families.map((f) => (
            <li key={f} className="flex items-center gap-1.5">
              <span className={`inline-block h-3 w-3 rounded-[3px] ${FAMILY_BG[f]}`} aria-hidden /> {FAMILY_LABEL[f]}
            </li>
          ))}
          <li className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-6 rounded-[3px] bg-press-2" style={NO_PO_STRIPES} aria-hidden /> Striped: no PO yet
          </li>
          <li className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-6 rounded-[3px] border border-dashed border-press-2" aria-hidden /> Idle
          </li>
          <li className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-0.5 bg-marking" aria-hidden /> Today
          </li>
          <li className="flex items-center gap-1.5">
            <span className="inline-block h-3.5 w-[3px] rounded-[2px] bg-press" aria-hidden /> Machine stops
          </li>
          {model.machines.some((m) => m.status === 'maintenance') && (
            <li className="flex items-center gap-1.5">
              <Wrench size={13} strokeWidth={2.5} className="text-caution" aria-hidden /> In maintenance
            </li>
          )}
        </ul>
        {/* Every month at once, or one month on its own */}
        <div role="group" aria-label="Months" className="mb-3 flex flex-wrap gap-1.5">
          {(['all', ...model.months] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setView(v)}
              className={`min-h-[40px] rounded-full border px-3.5 text-table font-semibold ${view === v ? 'border-press bg-press text-sheet' : 'border-rule bg-sheet hover:border-press-2'}`}
            >
              {v === 'all' ? 'All months' : monthOnly(v)}
              {v !== 'all' && <span className={`ml-1.5 text-small ${view === v ? 'text-sheet/80' : 'text-press-2'}`}>{runningIn(v).length}</span>}
            </button>
          ))}
        </div>
        {month && (
          <p className="mb-3 text-table">
            <span className="font-bold">
              {runningIn(month).length} of {model.machines.length} machines run in {monthLong(month)}
            </span>
            {stopsIn(month).length > 0 && (
              <span className="text-press-2">
                {' '}
                · stopping: {stopsIn(month).map((x) => `${x.name} ${dayMonth(x.stops!)}`).join(', ')}
              </span>
            )}
          </p>
        )}
        <Gantt
          key={view}
          groups={groups}
          span={month ? monthSpan(month) : model.range}
          months={month ? [month] : model.months}
          today={today}
          month={month ?? undefined}
        />
      </section>

      {noPo.length > 0 && <NoPoPanel rows={noPo} />}

      {groups.map(({ type, title, machines }) => {
        const autos = machines.some((m) => /auto/i.test(m.name))
        const manuals = machines.some((m) => !/auto/i.test(m.name))
        return (
          <section key={type} aria-labelledby={`h-${type}`}>
            <div className="flex items-center gap-3">
              <span className="flex shrink-0 gap-1 rounded-card bg-sheet p-1.5 shadow-card">
                {manuals && <MachineArt type={type} status="running" family={null} className="h-12 w-20" />}
                {type === 'trimming' && autos && <MachineArt type={type} status="running" family={null} auto className="h-12 w-20" />}
              </span>
              <h2 id={`h-${type}`} className="text-title font-bold">
                {title} <span className="text-press-2">{machines.length}</span>
              </h2>
            </div>
            <ul className="mt-3 grid items-stretch gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {machines.map((m) => (
                <li key={m.id}>
                  <MachineCard machine={m} today={today} live={model.live} />
                </li>
              ))}
            </ul>
          </section>
        )
      })}

      {model.unplanned.length > 0 && <Unplanned pos={model.unplanned} />}
    </div>
  )
}

/** Open orders on efdashboard.com that no run on either plan names. */
function Unplanned({ pos }: { pos: TrackerPo[] }) {
  const active = pos.filter((p) => !p.isInactive)
  const inactive = pos.filter((p) => p.isInactive)
  const row = (p: TrackerPo) => (
    <li key={p.po} className="flex flex-wrap items-center justify-between gap-2 py-2 text-table">
      <span>
        <span className="font-semibold">PO {p.po}</span> <span className="text-press-2">{p.product}</span>
        {p.readyDate && <span className="block text-small text-press-2">Cargo ready {dayMonth(p.readyDate)}</span>}
      </span>
      <StatePill state={p.state} />
    </li>
  )
  return (
    <section aria-labelledby="unplanned" className="rounded-card bg-sheet p-4 shadow-card sm:p-5">
      <h2 id="unplanned" className="flex items-center gap-2 text-title font-bold">
        <AlertTriangle size={20} aria-hidden className="text-caution" /> Open orders on no machine's plan
      </h2>
      <p className="mt-1 max-w-prose text-table text-press-2">
        Orders efdashboard.com shows as not yet dispatched that no run on the production or finishing plan names.
      </p>
      {active.length > 0 && <ul className="mt-3 divide-y divide-rule">{active.map(row)}</ul>}
      {inactive.length > 0 && (
        <details className="mt-3 border-t border-rule pt-2">
          <summary className="min-h-[36px] cursor-pointer py-1.5 text-table font-semibold">
            {inactive.length} more on hold or waiting for a PO
          </summary>
          <ul className="divide-y divide-rule">{inactive.map(row)}</ul>
        </details>
      )}
    </section>
  )
}
