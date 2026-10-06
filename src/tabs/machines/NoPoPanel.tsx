import { FileQuestion } from 'lucide-react'
import type { NoPoRow } from '../../engine/machines'
import { NO_PO_STRIPES } from './Gantt'
import { MachineLinks, NoPoChip, spanText, Swatch } from './parts'

/**
 * Work the plans schedule before its PO is received, and work made with no PO,
 * one row per product, in the plans' own words.
 */
const GROUPS: { kind: NoPoRow['kind']; title: string; lede: string }[] = [
  { kind: 'required', title: 'POs still required', lede: 'Planned production the sheets mark “PO Required”.' },
  { kind: 'no-po', title: 'Made with no PO', lede: 'Extra and monthly production the sheets list with no PO.' },
  { kind: 'none', title: 'No PO on the plan', lede: 'Runs from today with no PO against them on either sheet.' },
]

export default function NoPoPanel({ rows }: { rows: NoPoRow[] }) {
  const required = rows.filter((r) => r.kind === 'required')
  const pos = required.reduce((n, r) => n + (r.count ?? 0), 0)

  return (
    <section aria-labelledby="nopo-title" className="rounded-card bg-sheet p-4 shadow-card sm:p-5">
      <h2 id="nopo-title" className="flex items-center gap-2 text-title font-bold">
        <FileQuestion size={20} aria-hidden className="text-caution" /> Planned without a PO
      </h2>
      <p className="mt-1 flex max-w-prose flex-wrap items-center gap-x-1.5 text-table text-press-2">
        {pos > 0 && `${pos} POs are still required across ${required.length} products. `}
        These runs show striped
        <span className="inline-block h-3 w-6 rounded-[3px] bg-press-2" style={{ ...NO_PO_STRIPES, printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }} aria-hidden />
        on the chart.
      </p>

      {GROUPS.map(({ kind, title, lede }) => {
        const group = rows.filter((r) => r.kind === kind)
        if (!group.length) return null
        return (
          <div key={kind} className="mt-5">
            <h3 className="text-table font-bold">{title}</h3>
            <p className="text-small text-press-2">{lede}</p>
            <ul className="mt-2 divide-y divide-rule border-y border-rule">
              {group.map((r) => (
                <li key={r.key} className="grid gap-x-4 gap-y-1.5 py-2.5 sm:grid-cols-[11rem_minmax(0,15rem)_1fr]">
                  <span className="flex items-baseline gap-2 font-semibold">
                    <Swatch family={r.family} className="translate-y-px" /> {r.product}
                  </span>
                  <span>
                    <NoPoChip kind={r.kind} text={r.text} />
                  </span>
                  <ul className="space-y-0.5 text-small">
                    {r.where.map((w) => (
                      <li key={w.machines.map((m) => m.id).join()}>
                        <MachineLinks machines={w.machines} />
                        <span className="text-press-2">: {w.spans.map(spanText).join(', ')}</span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </section>
  )
}
