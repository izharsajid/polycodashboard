import { AlertTriangle, Factory, Layers, Scissors, ScanLine, type LucideIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { FAMILY_BG, FAMILY_LABEL } from '../../components/machines/MachineArt'
import StatePill from '../../components/StatePill'
import { MachinesPayload } from '../../data/schemas'
import { useApiData } from '../../data/useApiData'
import { useTracker } from '../../data/useTracker'
import { buildMachines, machineMonth, type Family, type MachineType } from '../../engine/machines'
import { day } from '../../lib/format'
import MachineCard from './MachineCard'

/**
 * Machine utilisation, month by month: what each forming, lamination, trimming
 * and X-ray machine runs, until when, and the open POs it is making.
 */
const SECTIONS: { type: MachineType; title: string; Icon: LucideIcon }[] = [
  { type: 'forming', title: 'Thermoforming', Icon: Factory },
  { type: 'lamination', title: 'Lamination', Icon: Layers },
  { type: 'trimming', title: 'Trimming', Icon: Scissors },
  { type: 'xray', title: 'X-ray inspection', Icon: ScanLine },
]

const sourceOf = (sources: Set<string>) =>
  sources.size > 1 ? 'Plan, and live from efdashboard.com' : sources.has('plan') ? 'From the plan' : 'Live from efdashboard.com'

const monthName = (m: string) =>
  new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${m}-01T00:00:00Z`))

export default function MachinesTab() {
  const plan = useApiData('/api/machines', MachinesPayload, 'machine plan')
  const { tracker, lineUsage, error, loading } = useTracker()
  const model = useMemo(
    () => (plan.status === 'ready' ? buildMachines(plan.data.plan, tracker, lineUsage) : null),
    [plan, tracker, lineUsage],
  )
  const [chosen, setChosen] = useState<string | null>(null)

  if (plan.status === 'loading' || loading) return <p className="mt-8 text-body text-press-2" aria-busy="true">Loading the machines.</p>
  if (plan.status === 'failed' || !model) {
    return (
      <p role="alert" className="mt-8 max-w-prose rounded-card border-l-3 border-alert bg-sheet py-3 pl-4 pr-4 text-body text-alert">
        {plan.status === 'failed' ? plan.error : 'The machine plan could not be read.'}
      </p>
    )
  }

  const month = chosen ?? model.asAt.slice(0, 7)
  const months = model.machines.map((m) => machineMonth(m, month))
  const forming = months.filter((x) => x.machine.type === 'forming')
  const running = forming.filter((x) => x.active).length
  const stopping = forming.filter((x) => x.stopDay)
  const families = [...new Set(months.flatMap((x) => x.segments.map((s) => s.family)))] as Family[]
  const activeUnplanned = model.unplanned.filter((p) => !p.isInactive)
  const inactiveUnplanned = model.unplanned.filter((p) => p.isInactive)

  return (
    <div className="space-y-8 pt-6">
      <header>
        <h1 className="condensed text-figure font-bold">Machines</h1>
        <p className="mt-1 max-w-prose text-table text-press-2">
          What each machine runs, until when, and the open POs it is making. Thermoforming, lamination and the manual
          trimmers follow the production and finishing plans of {day(model.asAt)}; the auto trimmers and X-ray are live
          from efdashboard.com.
          {error && ` efdashboard.com could not be read just now (${error}), so no POs are matched.`}
        </p>
      </header>

      <nav aria-label="Month" className="flex flex-wrap gap-1.5">
        {model.months.map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={m === month}
            onClick={() => setChosen(m)}
            className={`min-h-[40px] rounded-full border px-4 text-table font-semibold ${m === month ? 'border-press bg-press text-sheet' : 'border-rule bg-sheet hover:border-press-2'}`}
          >
            {monthName(m)}
          </button>
        ))}
      </nav>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Forming machines running" value={`${running} of ${forming.length}`} />
        <Stat label={`Stopping in ${monthName(month)}`} value={stopping.length ? stopping.map((x) => `${x.machine.name.replace('Machine ', 'M')} on ${x.stopDay}`).join(', ') : 'None'} />
        <Stat label="Open orders with no machine planned" value={String(activeUnplanned.length)} tone={activeUnplanned.length ? 'caution' : 'plain'} />
      </div>

      {families.length > 0 && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-small text-press-2" aria-label="Product colours">
          {families.map((f) => (
            <li key={f} className="flex items-center gap-1.5">
              <span className={`inline-block h-3 w-3 rounded-sm ${FAMILY_BG[f]}`} aria-hidden /> {FAMILY_LABEL[f]}
            </li>
          ))}
          <li className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-0.5 bg-marking" aria-hidden /> Today
          </li>
          <li className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-0.5 bg-press" aria-hidden /> Machine stops
          </li>
        </ul>
      )}

      {SECTIONS.map(({ type, title, Icon }) => {
        const list = months.filter((x) => x.machine.type === type)
        if (!list.length) return null
        const source = sourceOf(new Set(list.map((x) => x.machine.source)))
        return (
          <section key={type} aria-labelledby={`sec-${type}`}>
            <h2 id={`sec-${type}`} className="flex items-baseline gap-2 text-title font-bold">
              <Icon size={20} aria-hidden className="self-center" /> {title}
              <span className="text-small font-normal text-press-2">{source}</span>
            </h2>
            <ul className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {list.map((x) => (
                <li key={x.machine.id}>
                  <MachineCard mm={x} month={month} today={model.asAt} />
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
