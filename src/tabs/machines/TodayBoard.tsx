import type { LucideIcon } from 'lucide-react'
import { nowOf, type Machine, type Now } from '../../engine/machines'
import { day } from '../../lib/format'
import { look, nextStep, shortName, StatusPill, Swatch } from './parts'

/**
 * Every machine on one board, as the top of the production sheet lays them out:
 * its status today, what it is running, and what happens next. Each tile opens
 * that machine's card further down the page.
 */
export type BoardGroup = { title: string; Icon: LucideIcon; machines: Machine[] }

const COUNT_WORDS: [Now['state'], string][] = [
  ['running', 'running'],
  ['maintenance', 'in maintenance'],
  ['idle', 'idle'],
  ['starts', 'starting later'],
  ['stopped', 'stopped'],
  ['no-plan', 'with no plan yet'],
]

export default function TodayBoard({ groups, today }: { groups: BoardGroup[]; today: string }) {
  const all = groups.flatMap((g) => g.machines.map((m) => nowOf(m, today)))
  const counts = COUNT_WORDS.map(([state, words]) => [all.filter((n) => n.state === state).length, words] as const).filter(([n]) => n > 0)

  return (
    <section aria-labelledby="today-title">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="today-title" className="text-title font-bold">
          Today, {day(today)}
        </h2>
        <p className="text-table text-press-2">{counts.map(([n, words]) => `${n} ${words}`).join(', ')}</p>
      </div>

      <div className="mt-3 space-y-4">
        {groups.map(({ title, Icon, machines }) => (
          <div key={title} role="group" aria-label={title}>
            <p className="mb-1.5 flex items-center gap-1.5 text-small font-bold uppercase tracking-wide text-press-2">
              <Icon size={14} aria-hidden /> {title}
            </p>
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {machines.map((m) => (
                <li key={m.id}>
                  <Tile machine={m} now={nowOf(m, today)} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}

function Tile({ machine: m, now }: { machine: Machine; now: Now }) {
  const { quiet } = look(now)
  const bar = 'bar' in now ? now.bar : null
  const detail = now.state === 'maintenance' ? m.note : nextStep(now, m.stopNote)
  const ground = now.state === 'maintenance' ? 'border-caution bg-caution-wash' : quiet ? 'border-rule bg-mist' : 'border-rule bg-sheet'
  return (
    <a
      href={`#m-${m.id}`}
      className={`flex h-full flex-col gap-1.5 rounded-card border p-3 shadow-card transition-shadow hover:shadow-lift ${ground}`}
    >
      <span className="condensed text-body font-bold leading-tight">{shortName(m.name)}</span>
      <StatusPill now={now} />
      {bar && (
        <span className={`flex items-baseline gap-1.5 text-table font-semibold ${quiet ? 'text-press-2' : ''}`}>
          <Swatch family={bar.family} className="translate-y-px" />
          {bar.product}
        </span>
      )}
      {detail && <span className="text-small text-press-2">{detail}</span>}
    </a>
  )
}
