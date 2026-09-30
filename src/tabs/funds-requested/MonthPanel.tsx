import { CalendarClock, Flag, TrendingUp } from 'lucide-react'
import Badge from '../../components/Badge'
import CategoryBar from '../../components/CategoryBar'
import { CategoryIcon } from '../../components/categoryStyle'
import Panel from '../../components/Panel'
import Tile from '../../components/Tile'
import { CATEGORY_LABEL } from '../../engine/classify'
import { kindLabel, type Statement } from '../../engine/funds'
import { amount, monthLong, percent, range } from '../../lib/format'

/**
 * A month opened up: costs, other income and the request as three tiles, the
 * split by category, then every line as issued, grouped by category. Lines on
 * hold or paid elsewhere keep their remark as a caution tag.
 */
export default function MonthPanel({ s, onClose }: { s: Statement | null; onClose: () => void }) {
  return (
    <Panel
      open={s !== null}
      onClose={onClose}
      title={s ? `${monthLong(s.id)} statement` : ''}
      eyebrow={s ? range(s.periodStart, s.periodEnd) : undefined}
      badges={
        s && (
          <>
            <Badge Icon={s.isRequest ? undefined : CalendarClock}>{kindLabel(s.kind)}</Badge>
            {s.incomeCents > 0 && (
              <Badge tone="income" Icon={TrendingUp}>
                Other income received
              </Badge>
            )}
          </>
        )
      }
    >
      {s && <Body s={s} />}
    </Panel>
  )
}

function Body({ s }: { s: Statement }) {
  const positive = s.groups.filter((g) => g.cents > 0).reduce((a, g) => a + g.cents, 0)

  return (
    <div className="space-y-6 text-table">
      {/* Three tiles: what it cost, what came in against it, what was asked. */}
      <div className="grid gap-2 sm:grid-cols-3">
        <Tile label="Costs" value={amount(s.costsCents)} />
        <Tile
          label="Other income"
          value={s.incomeCents ? amount(-s.incomeCents) : '0.00'}
          tone={s.incomeCents ? 'income' : 'plain'}
        />
        <Tile label={s.isRequest ? 'Requested' : 'Spent'} value={amount(s.statedCents)} tone="strong" />
      </div>

      {s.notes
        .filter((n) => /^exception:/i.test(n))
        .map((n) => (
          <div key={n} role="note" className="flex gap-2 rounded-card bg-caution-wash p-3 text-caution">
            <Flag size={16} aria-hidden className="mt-0.5 shrink-0" />
            <p>
              <span className="block font-semibold">Month labels on this statement are in doubt</span>
              {n}
            </p>
          </div>
        ))}

      {/* The split by category. */}
      <section aria-label="Costs by category">
        <CategoryBar groups={s.groups} height={12} />
        <ul className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
          {s.groups.map((g) => (
            <li key={g.category} className="flex items-center gap-2.5">
              <CategoryIcon category={g.category} size={26} />
              <span className="min-w-0 flex-1">{CATEGORY_LABEL[g.category]}</span>
              <span className="num text-right">
                {amount(g.cents)}
                {g.cents > 0 && positive > 0 && (
                  <span className="block text-small text-press-2">{percent(g.cents / positive)}</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* Every line as issued, by category. */}
      <section aria-label="Lines as issued" className="space-y-3">
        {s.groups.map((g) => (
          <div key={g.category} className="rounded-card bg-mist p-3">
            <p className="flex items-center gap-2 font-semibold">
              <CategoryIcon category={g.category} size={22} />
              {CATEGORY_LABEL[g.category]}
            </p>
            <ul className="mt-2 divide-y divide-rule">
              {g.lines.map((l, i) => {
                const aside = l.cents === 0 && l.remarks
                return (
                  <li key={i} className="flex justify-between gap-4 py-2">
                    <span className={l.cents === 0 ? 'text-press-2' : ''}>
                      {l.description}
                      {l.remarks &&
                        (aside ? (
                          <span className="ml-2 inline-block rounded-full bg-caution-wash px-2 py-0.5 text-small font-semibold text-caution">
                            {l.remarks}
                          </span>
                        ) : (
                          <span className="mt-0.5 block text-small text-press-2">{l.remarks}</span>
                        ))}
                    </span>
                    <span className={`num shrink-0 ${l.cents < 0 ? 'font-semibold text-income' : l.cents === 0 ? 'text-press-2' : ''}`}>
                      {amount(l.cents)}
                      {l.cents < 0 && <span className="block text-right text-small">credit</span>}
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </section>

      {/* Other income, set against the costs. */}
      {s.income.length > 0 && (
        <section aria-label="Other income" className="rounded-card border-2 border-income bg-income-wash p-3 text-income">
          <p className="flex items-center gap-2 font-semibold">
            <TrendingUp size={18} aria-hidden />
            Other income, set against the costs
          </p>
          <ul className="mt-2">
            {s.income.map((l, i) => (
              <li key={i} className="flex justify-between gap-4 py-1">
                <span>{l.description}</span>
                <span className="num shrink-0 font-semibold">{amount(-l.cents)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="flex justify-between gap-4 border-t-2 border-press pt-2 text-body font-semibold">
        <span>{s.isRequest ? 'Requested from Polyco' : 'Spent, not a request'}</span>
        <span className="num">{amount(s.statedCents)}</span>
      </p>

      {s.notes.filter((n) => !/^exception:/i.test(n)).length > 0 && (
        <ul className="space-y-1 text-small text-press-2">
          {s.notes
            .filter((n) => !/^exception:/i.test(n))
            .map((n) => (
              <li key={n}>{n}</li>
            ))}
        </ul>
      )}
    </div>
  )
}
