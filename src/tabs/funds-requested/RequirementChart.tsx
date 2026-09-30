import { useState, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react'
import { CATEGORIES, CATEGORY_LABEL, type Category } from '../../engine/classify'
import { kindLabel, statementName, type Model, type Segment, type Statement } from '../../engine/funds'
import { dayMonth, monthOnly, monthShort, range, thousands, usd } from '../../lib/format'
import { CATEGORY_STYLE, hatchId } from './categoryStyle'
import { useChartWidth } from './useChartWidth'

/**
 * The monthly requirement: one column per statement, stacked by category.
 *
 * Columns, not a line: each statement is a separate document, and a line would
 * draw a slope across the days no statement covers. Columns are equal width
 * rather than as wide as their period, because a wider column would read as more
 * money. The true calendar is drawn by the coverage rail underneath.
 *
 * The three statement kinds are told apart by fill, not colour, so colour stays
 * with the categories: solid for a request, hatched for the part of August's
 * request that was already utilised, and a dashed outline with no fill for
 * October, which records actuals and is not a request.
 */

type Props = {
  model: Model
  active: ReadonlySet<Category>
  selectedId: string
  onSelect: (id: string) => void
}

type Tip = { x: number; y: number; body: ReactNode }

/** Axis steps, in cents. Presentation only: the first that gives seven ticks or fewer. */
const STEPS = [2_500_000, 5_000_000, 10_000_000, 25_000_000]

export default function RequirementChart({ model, active, selectedId, onSelect }: Props) {
  const { ref, width, printing } = useChartWidth<HTMLDivElement>()
  const [tip, setTip] = useState<Tip | null>(null)
  const [focused, setFocused] = useState<number | null>(null)

  const statements = model.statements
  const narrow = width < 640
  const direct = width >= 900 || printing

  const H = printing ? 250 : narrow ? 260 : 330
  const compact = (width - 40 - (direct ? 172 : 8)) / Math.max(1, model.statements.length) < 56
  const M = { top: 30, right: direct ? 172 : 8, bottom: compact ? 36 : 58, left: 40 }
  const plotW = Math.max(0, width - M.left - M.right)
  const plotH = H - M.top - M.bottom

  const shown = (s: Statement) => s.segments.filter((g) => active.has(g.category))
  const pos = (s: Statement) => shown(s).filter((g) => g.cents > 0).reduce((a, g) => a + g.cents, 0)
  const neg = (s: Statement) => shown(s).filter((g) => g.cents < 0).reduce((a, g) => a + g.cents, 0)
  const net = (s: Statement) => pos(s) + neg(s)

  const maxPos = Math.max(...statements.map(pos), 1)
  const minNeg = Math.min(...statements.map(neg), 0)
  const step = STEPS.find((st) => (Math.ceil(maxPos / st) - Math.floor(minNeg / st)) <= 7) ?? STEPS[STEPS.length - 1]
  const top = Math.ceil(maxPos / step) * step
  const bottom = Math.floor(minNeg / step) * step
  const y = (cents: number) => M.top + ((top - cents) / (top - bottom)) * plotH
  const ticks: number[] = []
  for (let v = bottom; v <= top; v += step) ticks.push(v)

  const n = statements.length
  const slot = plotW / n
  const barW = Math.max(8, Math.min(52, slot * 0.62))
  const colX = (i: number) => M.left + i * slot + (slot - barW) / 2
  const selectedIndex = statements.findIndex((s) => s.id === selectedId)
  const filtered = active.size < CATEGORIES.length

  // ---- tooltip helpers ---------------------------------------------------
  const place = (e: MouseEvent, body: ReactNode) => {
    const box = ref.current?.getBoundingClientRect()
    if (!box) return
    setTip({ x: e.clientX - box.left, y: e.clientY - box.top, body })
  }

  const columnTip = (s: Statement) => (
    <>
      <p className="font-semibold">{statementName(s)}</p>
      <p className="text-press-2">{kindLabel(s.kind)}</p>
      <p className="mt-1">
        {filtered ? `${usd(net(s))} shown of ${usd(s.statedCents)} stated` : `${usd(s.statedCents)} stated`}
      </p>
      <ul className="mt-1 space-y-0.5">
        {CATEGORIES.filter((c) => active.has(c) && s.byCategory[c] !== 0).map((c) => (
          <li key={c} className="flex justify-between gap-4">
            <span>{CATEGORY_LABEL[c]}</span>
            <span className="num">{usd(s.byCategory[c])}</span>
          </li>
        ))}
      </ul>
    </>
  )

  const segmentTip = (s: Statement, g: Segment) => (
    <>
      <p className="font-semibold">{CATEGORY_LABEL[g.category]}</p>
      <p className="num">
        {usd(g.cents)}
        {g.utilised === true && ', utilised'}
        {g.utilised === false && ', still required'}
        {g.cents < 0 && ', a credit'}
      </p>
      <p className="text-press-2">
        {monthShort(s.id)} statement, {range(s.periodStart, s.periodEnd)}
      </p>
      <p className="text-press-2">{kindLabel(s.kind)}</p>
    </>
  )

  // ---- keyboard: the columns are one radio group --------------------------
  const onKey = (e: KeyboardEvent, i: number) => {
    const to =
      e.key === 'ArrowRight' || e.key === 'ArrowDown' ? Math.min(n - 1, i + 1)
      : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? Math.max(0, i - 1)
      : e.key === 'Home' ? 0
      : e.key === 'End' ? n - 1
      : null
    if (to !== null) {
      e.preventDefault()
      onSelect(statements[to].id)
      const next = (e.currentTarget.parentNode as SVGGElement | null)?.children[to] as SVGGElement | undefined
      next?.focus()
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onSelect(statements[i].id)
    }
  }

  // ---- direct labels on the last column -----------------------------------
  const last = statements[n - 1]
  const labels: { category: Category; y: number; mid: number }[] = []
  if (direct && width > 0) {
    let up = 0
    let down = 0
    for (const g of shown(last)) {
      const from = g.cents >= 0 ? up : down
      const to = from + g.cents
      if (g.cents >= 0) up = to
      else down = to
      const mid = (y(from) + y(to)) / 2
      const existing = labels.find((l) => l.category === g.category)
      if (existing) existing.mid = (existing.mid + mid) / 2
      else labels.push({ category: g.category, y: mid, mid })
    }
    labels.sort((a, b) => a.mid - b.mid)
    const GAP = 14
    for (let i = 1; i < labels.length; i++) labels[i].y = Math.max(labels[i].y, labels[i - 1].y + GAP)
    const overflow = labels.length ? labels[labels.length - 1].y - (H - M.bottom + 4) : 0
    if (overflow > 0) for (const l of labels) l.y -= overflow
  }

  const xLabel = (s: Statement, i: number) => {
    const firstOfYear = i === 0 || s.id.endsWith('-01')
    const year = s.id.slice(0, 4)
    // Too narrow for dates under the columns: initials, with an asterisk on each
    // irregular period, and the real ranges in the footnote under the chart.
    if (compact) {
      return {
        one: `${monthOnly(s.id).charAt(0)}${s.matchesMonth ? '' : '*'}`,
        two: firstOfYear ? `’${year.slice(2)}` : '',
        three: '',
      }
    }
    // An irregular period carries its real dates under its month, on two lines
    // so neighbouring ranges never run into each other.
    return {
      one: firstOfYear ? `${monthOnly(s.id)} ${year}` : monthOnly(s.id),
      two: !s.isRequest ? 'actuals' : s.matchesMonth ? '' : dayMonth(s.periodStart),
      three: s.isRequest && !s.matchesMonth ? `to ${dayMonth(s.periodEnd)}` : '',
    }
  }

  return (
    <div ref={ref} className="relative w-full" onMouseLeave={() => setTip(null)}>
      {width > 0 ? (
        <svg
          width="100%"
          height={H}
          viewBox={`0 0 ${width} ${H}`}
          className="block overflow-visible"
          role="group"
          aria-label="Funding requested by statement, stacked by category"
        >
          <defs>
            {CATEGORIES.map((c) => (
              <pattern key={c} id={hatchId(c)} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width="6" height="6" className={CATEGORY_STYLE[c].fill} />
                <rect width="2.5" height="6" className="fill-sheet" opacity="0.85" />
              </pattern>
            ))}
          </defs>

          {/* Selection band behind the selected column. */}
          {selectedIndex >= 0 && (
            <rect
              x={M.left + selectedIndex * slot + 1}
              y={M.top - 24}
              width={Math.max(0, slot - 2)}
              height={plotH + 24 + (narrow ? 4 : 10)}
              className="fill-marking"
              opacity={0.45}
            />
          )}

          {/* Grid and axis. */}
          <text x={0} y={12} className="fill-press-2 text-small">US$ thousands</text>
          {ticks.map((v) => (
            <g key={v}>
              <line x1={M.left} x2={M.left + plotW} y1={y(v)} y2={y(v)} className={v === 0 ? 'stroke-press' : 'stroke-rule'} strokeWidth={1} />
              <text x={M.left - 6} y={y(v) + 4} textAnchor="end" className="fill-press-2 text-small num">
                {thousands(v)}
              </text>
            </g>
          ))}

          {/* Columns: a radio group, one tab stop, arrows move the selection. */}
          <g role="radiogroup" aria-label="Statements. Choose one to see its lines below.">
            {statements.map((s, i) => {
              const x = colX(i)
              const selected = i === selectedIndex
              const lab = xLabel(s, i)
              let up = 0
              let down = 0
              return (
                <g
                  key={s.id}
                  role="radio"
                  aria-checked={selected}
                  aria-label={`${statementName(s)}. ${kindLabel(s.kind)}. ${
                    filtered ? `${usd(net(s))} shown of ${usd(s.statedCents)} stated` : `${usd(s.statedCents)} stated`
                  }.`}
                  tabIndex={selected || (selectedIndex < 0 && i === 0) ? 0 : -1}
                  onClick={() => onSelect(s.id)}
                  onKeyDown={(e) => onKey(e, i)}
                  onFocus={() => {
                    setFocused(i)
                    setTip({ x: x + barW / 2, y: y(Math.max(pos(s), 0)), body: columnTip(s) })
                  }}
                  onBlur={() => {
                    setFocused(null)
                    setTip(null)
                  }}
                  className="cursor-pointer outline-none"
                >
                  {/* Hit area: the whole slot, taller than the mark. */}
                  <rect
                    x={M.left + i * slot}
                    y={M.top - 24}
                    width={slot}
                    height={plotH + 24 + M.bottom}
                    fill="transparent"
                    onMouseMove={(e) => place(e, columnTip(s))}
                  />

                  {s.isRequest ? (
                    shown(s).map((g) => {
                      const from = g.cents >= 0 ? up : down
                      const to = from + g.cents
                      if (g.cents >= 0) up = to
                      else down = to
                      const y1 = Math.min(y(from), y(to))
                      const h = Math.abs(y(from) - y(to))
                      return (
                        <rect
                          key={`${g.category}-${String(g.utilised)}`}
                          x={x}
                          // A 1.5px sheet-coloured gap between stacked fills.
                          y={y1 + (g.cents >= 0 ? 1.5 : 0)}
                          width={barW}
                          height={Math.max(0, h - 1.5)}
                          className={g.utilised ? undefined : CATEGORY_STYLE[g.category].fill}
                          fill={g.utilised ? `url(#${hatchId(g.category)})` : undefined}
                          onMouseMove={(e) => {
                            e.stopPropagation()
                            place(e, segmentTip(s, g))
                          }}
                        />
                      )
                    })
                  ) : (
                    <rect
                      x={x + 1}
                      y={y(net(s))}
                      width={barW - 2}
                      height={Math.max(0, y(0) - y(net(s)))}
                      className="fill-none stroke-press-2"
                      strokeWidth={1.5}
                      strokeDasharray="4 3"
                    />
                  )}

                  {/* Net tick where a credit hangs below the line. */}
                  {s.isRequest && neg(s) < 0 && (
                    <line x1={x - 4} x2={x + barW + 4} y1={y(net(s))} y2={y(net(s))} className="stroke-press" strokeWidth={2} />
                  )}

                  {selected && (
                    <rect
                      x={x - 2}
                      y={y(Math.max(pos(s), net(s))) - 2}
                      width={barW + 4}
                      height={Math.abs(y(neg(s)) - y(Math.max(pos(s), net(s)))) + 4}
                      className="fill-none stroke-press"
                      strokeWidth={2}
                    />
                  )}

                  {focused === i && (
                    <rect
                      x={M.left + i * slot + 2}
                      y={M.top - 22}
                      width={Math.max(0, slot - 4)}
                      height={plotH + 22 + (narrow ? 2 : 8)}
                      className="fill-none stroke-press"
                      strokeWidth={3}
                    />
                  )}

                  {/* Total above the column, in thousands, on wide screens and the selected one always. */}
                  {(!narrow || selected) && (
                    <text
                      x={x + barW / 2}
                      y={y(Math.max(pos(s), net(s))) - 6}
                      textAnchor="middle"
                      className={`text-small num ${selected ? 'fill-press font-bold' : 'fill-press-2'}`}
                    >
                      {thousands(net(s))}
                    </text>
                  )}

                  <text x={M.left + i * slot + slot / 2} y={H - M.bottom + 16} textAnchor="middle" className="fill-press text-small">
                    {lab.one}
                  </text>
                  {lab.two && (
                    <text x={M.left + i * slot + slot / 2} y={H - M.bottom + 30} textAnchor="middle" className="fill-press-2 text-small">
                      {lab.two}
                    </text>
                  )}
                  {lab.three && (
                    <text x={M.left + i * slot + slot / 2} y={H - M.bottom + 43} textAnchor="middle" className="fill-press-2 text-small">
                      {lab.three}
                    </text>
                  )}
                </g>
              )
            })}
          </g>

          {/* Direct labels, so the chart reads without the legend. */}
          {labels.map((l) => (
            <g key={l.category} aria-hidden>
              <line
                x1={colX(n - 1) + barW + 3}
                x2={M.left + plotW + 10}
                y1={l.mid}
                y2={l.y}
                className={CATEGORY_STYLE[l.category].stroke}
                strokeWidth={1.5}
              />
              <text x={M.left + plotW + 14} y={l.y + 4} className="fill-press text-small">
                {CATEGORY_LABEL[l.category]}
              </text>
            </g>
          ))}
        </svg>
      ) : (
        <div style={{ height: H }} />
      )}

      {tip && !printing && (
        <div
          className="pointer-events-none absolute z-10 w-max max-w-[280px] border border-press bg-sheet px-3 py-2 text-small text-press"
          style={{
            left: Math.min(Math.max(0, tip.x + 12), Math.max(0, width - 280)),
            top: Math.max(0, tip.y - 12),
            transform: 'translateY(-100%)',
          }}
          aria-hidden
        >
          {tip.body}
        </div>
      )}
    </div>
  )
}
