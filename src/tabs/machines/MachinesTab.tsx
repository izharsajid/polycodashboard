import { AlertTriangle, Factory, Layers, Scissors, ScanLine, type LucideIcon } from 'lucide-react'
import { useMemo } from 'react'
import MachineArt, { FAMILY_BG, FAMILY_LABEL } from '../../components/machines/MachineArt'
import StatePill from '../../components/StatePill'
import { MachinesPayload } from '../../data/schemas'
import { useApiData } from '../../data/useApiData'
import { useTracker } from '../../data/useTracker'
import { buildMachines, timeline, upcoming, type Family, type MachineType } from '../../engine/machines'
import { day, dayMonth } from '../../lib/format'
import Gantt from './Gantt'
import MachineRow from './MachineRow'

/**
 * Machine utilisation: one Gantt chart of when every machine runs until, then
 * each kind of machine in turn, with what it runs and the open POs it makes.
 */
const SECTIONS: { type: MachineType; title: string; Icon: LucideIcon }[] = [
  { type: 'forming', title: 'Thermoforming', Icon: Factory },
  { type: 'trimming', title: 'Trimming', Icon: Scissors },
  { type: 'lamination', title: 'Lamination', Icon: Layers },
  { type: 'xray', title: 'X-ray', Icon: ScanLine },
]

const sourceOf = (sources: Set<string>) =>
  sources.size > 1 ? 'Plan, and live from efdashboard.com' : sources.has('plan') ? 'From the plan' : 'Live from efdashboard.com'

/** Today in Bahrain, as YYYY-MM-DD. */
const todayIso = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bahrain' })

export default function MachinesTab() {
  const plan = useApiData('/api/machines', MachinesPayload, 'machine plan')
  const { tracker, lineUsage, error, loading } = useTracker()
  const model = useMemo(
    () => (plan.status === 'ready' ? buildMachines(plan.data.plan, tracker, lineUsage) : null),
    [plan, tracker, lineUsage],
  )

  if (plan.status === 'loading' || loading) return <p className="mt-8 text-body text-press-2" aria-busy="true">Loading the machines.</p>
  if (plan.status === 'failed' || !model) {
    return (
      <p role="alert" className="mt-8 max-w-prose rounded-card border-l-3 border-alert bg-sheet py-3 pl-4 pr-4 text-body text-alert">
        {plan.status === 'failed' ? plan.error : 'The machine plan could not be read.'}
      </p>
    )
  }

  const today = todayIso()
  const runningNow = (id: string) => {
    const [first] = upcoming(model.machines.find((m) => m.id === id)!, today)
    return Boolean(first && first.from <= today)
  }
  const groups = SECTIONS.map((s) => ({ ...s, machines: model.machines.filter((m) => m.type === s.type) })).filter((g) => g.machines.length)
  const running = model.machines.filter((m) => runningNow(m.id)).length
  const nextStop = model.machines
    .filter((m) => m.stops && m.stops >= today)
    .sort((a, b) => a.stops!.localeCompare(b.stops!))[0]
  const families = [...new Set(model.machines.flatMap((m) => timeline(m, model.range).map((b) => b.family)))] as Family[]
  const activeUnplanned = model.unplanned.filter((p) => !p.isInactive)
  const inactiveUnplanned = model.unplanned.filter((p) => p.isInactive)

  return (
    <div className="space-y-8 pt-6">
      <header>
        <h1 className="condensed text-figure font-bold">Machines</h1>
        <p className="mt-1 max-w-prose text-table text-press-2">
          When each machine runs until, and the open POs it is making. Thermoforming, lamination and the manual trimmers
          follow the plans of {day(model.asAt)}; the auto trimmers and X-ray are live from efdashboard.com.
          {error && ` efdashboard.com could not be read just now (${error}), so no POs are matched.`}
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Running today" value={`${running} of ${model.machines.length} machines`} />
        <Stat label="Next to stop" value={nextStop ? `${nextStop.name}, ${dayMonth(nextStop.stops!)}` : 'None planned'} />
        <Stat label="Open orders with no forming machine" value={String(activeUnplanned.length)} tone={activeUnplanned.length ? 'caution' : 'plain'} />
      </div>

      <section aria-labelledby="gantt" className="rounded-card bg-sheet p-4 shadow-card sm:p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 id="gantt" className="text-title font-bold">When each machine runs until</h2>
          <p className="text-small text-press-2">Hover or tap a bar for the product, dates and POs</p>
        </div>
        <ul className="mb-4 mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-small text-press-2" aria-label="Key">
          {families.map((f) => (
            <li key={f} className="flex items-center gap-1.5">
              <span className={`inline-block h-3 w-3 rounded-sm ${FAMILY_BG[f]}`} aria-hidden /> {FAMILY_LABEL[f]}
            </li>
          ))}
          <li className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-0.5 bg-marking" aria-hidden /> Today
          </li>
          <li className="flex items-center gap-1.5">
            <span className="inline-block h-3.5 w-[3px] rounded-sm bg-press" aria-hidden /> Machine stops
          </li>
        </ul>
        <Gantt groups={groups} span={model.range} months={model.months} today={today} />
      </section>

      <nav aria-label="Machine kinds" className="flex flex-wrap gap-1.5">
        {groups.map(({ type, title, Icon, machines }) => (
          <a
            key={type}
            href={`#sec-${type}`}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-rule bg-sheet px-4 text-table font-semibold hover:border-press-2"
          >
            <Icon size={16} aria-hidden /> {title}
            <span className="text-press-2">{machines.length}</span>
          </a>
        ))}
      </nav>

      {groups.map(({ type, title, machines }) => {
        const autos = machines.some((m) => /auto/i.test(m.name))
        const manuals = machines.some((m) => !/auto/i.test(m.name))
        return (
          <section key={type} id={`sec-${type}`} aria-labelledby={`h-${type}`} className="scroll-mt-4">
            <div className="flex items-center gap-3">
              <span className="flex shrink-0 gap-1 rounded-card bg-sheet p-1.5 shadow-card">
                {manuals && <MachineArt type={type} status="running" family={null} className="h-12 w-20" />}
                {type === 'trimming' && autos && <MachineArt type={type} status="running" family={null} auto className="h-12 w-20" />}
              </span>
              <div>
                <h2 id={`h-${type}`} className="text-title font-bold">{title}</h2>
                <p className="text-small text-press-2">
                  {machines.length} {machines.length === 1 ? 'machine' : 'machines'}, {machines.filter((m) => runningNow(m.id)).length}{' '}
                  running today · {sourceOf(new Set(machines.map((m) => m.source)))}
                </p>
              </div>
            </div>
            <ul className="mt-3 grid items-start gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {machines.map((m) => (
                <li key={m.id}>
                  <MachineRow machine={m} today={today} />
                </li>
              ))}
            </ul>
          </section>
        )
      })}

      {model.unplanned.length > 0 && (
        <section aria-labelledby="unplanned" className="rounded-card bg-sheet p-5 shadow-card">
          <h2 id="unplanned" className="flex items-center gap-2 text-title font-bold">
            <AlertTriangle size={20} aria-hidden className="text-caution" /> Open orders with no forming machine planned
          </h2>
          <p className="mt-1 text-small text-press-2">Orders on efdashboard.com not yet dispatched that no run in the plan makes.</p>
          <ul className="mt-3 divide-y divide-rule">
            {[...activeUnplanned, ...inactiveUnplanned].map((p) => (
              <li key={p.po} className="flex flex-wrap items-center justify-between gap-2 py-2 text-table">
                <span>
                  <span className="font-semibold">PO {p.po}</span> <span className="text-press-2">{p.product}</span>
                  {p.readyDate && <span className="block text-small text-press-2">Cargo ready {day(p.readyDate)}</span>}
                </span>
                <StatePill state={p.state} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {model.differences.length > 0 && (
        <section aria-labelledby="differences" className="rounded-card bg-sheet p-5 shadow-card">
          <h2 id="differences" className="text-title font-bold">Where efdashboard.com's Line Usage differs from the plan</h2>
          <p className="mt-1 text-small text-press-2">Update one or the other so both show the same machine.</p>
          <ul className="mt-3 divide-y divide-rule">
            {model.differences.map((d) => (
              <li key={d.machine} className="grid gap-1 py-2 text-table sm:grid-cols-[8rem_1fr_1fr]">
                <span className="font-semibold">{d.machine}</span>
                <span>
                  <span className="text-small text-press-2">Plan: </span>
                  {d.plan}
                </span>
                <span>
                  <span className="text-small text-press-2">Line Usage: </span>
                  {d.lineUsage}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function Stat({ label, value, tone = 'plain' }: { label: string; value: string; tone?: 'plain' | 'caution' }) {
  return (
    <div className={`rounded-card p-4 shadow-card ${tone === 'caution' ? 'bg-caution-wash text-caution' : 'bg-sheet'}`}>
      <p className="text-small opacity-80">{label}</p>
      <p className="mt-1 text-title font-bold">{value}</p>
    </div>
  )
}
