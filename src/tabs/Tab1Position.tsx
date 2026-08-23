import { useState } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import type { LedgerT } from '../lib/schema'
import { cumulativeSeries, orderCover, uncoveredAdvance, fmt } from '../lib/engine'
import { positionFinding } from '../lib/engine/findings'
import { Finding, SectionHead, Tile, Working } from '../components/ui'

function monthLabel(iso: string) {
  const [y, m] = iso.split('-')
  return `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+m - 1]} ${y.slice(2)}`
}

/** Twelve months back from the last point in the series. */
const RECENT_MONTHS = 12

export default function Tab1Position({ ledger }: { ledger: LedgerT }) {
  const s = ledger.summary
  const advance = uncoveredAdvance(ledger)
  const cover = orderCover(ledger)
  const finding = positionFinding(ledger)
  const full = cumulativeSeries(ledger)
  const [showAll, setShowAll] = useState(false)

  const asAt = new Date(s.as_at + 'T00:00:00Z').toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  })

  // The series runs from January 2023 and the part that matters is the recent
  // divergence, which is otherwise compressed into the right of the axis.
  const cutoff = new Date(full[full.length - 1].date + 'T00:00:00Z')
  cutoff.setUTCMonth(cutoff.getUTCMonth() - RECENT_MONTHS)
  const recent = full.filter((p) => p.date >= cutoff.toISOString().slice(0, 10))
  const series = showAll ? full : recent

  // One tick per month. The series is keyed on ledger dates, several of which can
  // land in the same month, and letting the axis pick its own ticks prints the
  // same month label twice, which reads as an error.
  const monthTicks: string[] = []
  const seenMonths = new Set<string>()
  for (const point of series) {
    const month = point.date.slice(0, 7)
    if (seenMonths.has(month)) continue
    seenMonths.add(month)
    monthTicks.push(point.date)
  }

  const flagged = ledger.rows.filter((r) => r.flags.length).length
  const coverPct = Math.round((cover / advance) * 100)

  return (
    <section>
      <SectionHead
        kicker="Polyco position"
        title="Where we stand"
        lede="Advances received set against goods delivered, and against every order still open. All figures in US dollars."
        asAt={`As at ${asAt}`}
      />

      <Finding>{finding.sentence}</Finding>

      <div className="grid gap-2 sm:grid-cols-3">
        <Tile
          label="Received from Polyco"
          value={fmt(finding.received)}
          sub="Cumulative, all periods"
          tone="leaf"
        />
        <Tile
          label="Value delivered"
          value={fmt(finding.delivered)}
          sub="Goods shipped, including recharges"
        />
        <Tile
          label="Advance not yet covered"
          value={fmt(finding.uncovered)}
          sub="After every open order and ready container ships"
          tone="alert"
        />
      </div>

      <div className="card mt-2">
        <div className="px-2 pt-2 pb-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="text-subtitle font-semibold text-accent">
                Payment has run ahead of delivery since shipping tightened
              </h3>
              <p className="lede mt-1 max-w-2xl">
                The gap between the two lines is the advance Polyco is holding with us.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="no-print rounded border border-rule px-2 py-1 text-label font-semibold text-accent hover:bg-accent-soft"
            >
              {showAll ? 'Last 12 months' : 'Full history'}
            </button>
          </div>

          <div className="mt-3 h-[300px] -ml-2 sm:h-[340px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
                <defs>
                  {/* Derived from `rule`, per DESIGN.md: efdashboard has no hatch,
                      and a hatch survives a monochrome printer where a tint does not. */}
                  <pattern id="gapFill" width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
                    <rect width="6" height="6" fill="#FFFFFF" />
                    <line x1="0" y1="0" x2="0" y2="6" stroke="#DFE5DC" strokeWidth="1.6" />
                  </pattern>
                </defs>
                <CartesianGrid stroke="#DFE5DC" vertical={false} />
                <XAxis
                  dataKey="date" tickFormatter={monthLabel} ticks={monthTicks} minTickGap={40}
                  tick={{ fill: '#6D7869', fontSize: 11 }} stroke="#D8E5CE"
                />
                <YAxis
                  tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} width={56}
                  tick={{ fill: '#6D7869', fontSize: 11 }} stroke="#D8E5CE"
                />
                <Tooltip
                  labelFormatter={(v) => monthLabel(String(v))}
                  formatter={(v: number, n: string) => [fmt(v), n]}
                  contentStyle={{
                    border: '1px solid #DFE5DC', borderRadius: 6, fontSize: 12,
                    fontFamily: '"IBM Plex Mono", monospace',
                  }}
                />
                {/* Solid against dashed, so the two series stay apart in greyscale. */}
                <Area
                  type="stepAfter" dataKey="receivedCumulative" name="Received"
                  stroke="#294525" strokeWidth={2} fill="url(#gapFill)" fillOpacity={1}
                  isAnimationActive={false}
                />
                <Area
                  type="stepAfter" dataKey="deliveredCumulative" name="Delivered"
                  stroke="#507A48" strokeWidth={2} strokeDasharray="6 3" fill="#FFFFFF"
                  fillOpacity={1} isAnimationActive={false}
                />
                <ReferenceLine y={0} stroke="#D8E5CE" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-label text-ink-70">
            <span className="flex items-center gap-1">
              <span className="h-[2px] w-5 bg-accent inline-block" /> Received, cumulative
            </span>
            <span className="flex items-center gap-1">
              <span
                className="h-0 w-5 inline-block border-t-2 border-dashed border-accent"
              /> Delivered, cumulative
            </span>
            <span className="flex items-center gap-1">
              <span className="h-3 w-5 inline-block border border-rule" style={{
                backgroundImage: 'repeating-linear-gradient(45deg,#DFE5DC 0 1.6px,#FFF 1.6px 6px)',
              }} /> Advance outstanding
            </span>
          </div>

          <p className="lede mt-2 border-t border-rule pt-2">
            Open orders and finished containers cover {coverPct}% of the advance. An order
            delivered against this balance brings in no payment, because it has already been
            paid for.{' '}
            {flagged > 0 && (
              <span className="text-critical">
                {flagged} ledger lines carry a date recorded inconsistently in the source
                workbook and are being confirmed.
              </span>
            )}
          </p>
        </div>
      </div>

      <Working
        title="How the advance is covered"
        lede="The reconciliation behind the three figures above."
        defaultOpen
      >
        <div className="overflow-x-auto">
        <table className="w-full min-w-[22rem] text-table">
          <tbody>
            <Row label="Received from Polyco" value={s.total_received} />
            <Row label="Less: value delivered" value={-s.total_delivered} />
            <Row label="Advance held against future delivery" value={s.total_received - s.total_delivered} rule />
            <Row label="Less: open purchase orders" value={-s.pos_pending_to_deliver} />
            <Row label="Less: containers ready to load" value={-s.containers_ready_next_month} />
            <Row label="Less: containers in process" value={-s.containers_in_process_following_month} />
            <Row label="Advance not yet covered by an order" value={advance} rule strong />
          </tbody>
        </table>
        </div>
        <p className="lede mt-2">
          Cargo clearing and freight recharged to Polyco are already inside delivered value.
          They total {fmt(s.recharges_included_in_delivered)} and are shown for information,
          not deducted a second time.
        </p>
      </Working>
    </section>
  )
}

function Row({
  label, value, rule, strong,
}: { label: string; value: number; rule?: boolean; strong?: boolean }) {
  return (
    <tr className={rule ? 'border-t border-rule' : undefined}>
      <td className={`py-1 pr-2 ${strong ? 'font-semibold text-ink' : 'text-ink'}`}>{label}</td>
      <td className={`py-1 text-right num ${strong ? 'font-semibold text-ink' : 'text-ink'}`}>
        {value < 0 ? `(${fmt(Math.abs(value))})` : fmt(value)}
      </td>
    </tr>
  )
}
