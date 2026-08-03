import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import type { LedgerT } from '../lib/schema'
import { cumulativeSeries, orderCover, uncoveredAdvance, fmt } from '../lib/engine'
import { Tile, SectionHead, Note } from '../components/ui'

function monthLabel(iso: string) {
  const [y, m] = iso.split('-')
  return `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+m - 1]} ${y.slice(2)}`
}

export default function Tab1Position({ ledger }: { ledger: LedgerT }) {
  const s = ledger.summary
  const advance = uncoveredAdvance(ledger)
  const cover = orderCover(ledger)
  const series = cumulativeSeries(ledger)
  const asAt = new Date(s.as_at + 'T00:00:00Z').toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  })

  const coverPct = Math.round((cover / advance) * 100)

  return (
    <section>
      <SectionHead
        n="01"
        title="Where we stand with Polyco"
        lede={`All figures in US dollars, as at ${asAt}. Advances received are set against the value of
               goods delivered and against every order still open.`}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 mb-8">
        <Tile label="Received from Polyco" value={fmt(s.total_received)} sub="Cumulative, all periods" />
        <Tile label="Value delivered" value={fmt(s.total_delivered)} sub="Goods shipped and charges recharged" />
        <Tile label="Open order book" value={fmt(s.pos_pending_to_deliver)} tone="leaf" sub="Purchase orders still to make" />
        <Tile
          label="Containers ready and in process"
          value={fmt(s.containers_ready_next_month + s.containers_in_process_following_month)}
          tone="leaf"
          sub={`${fmt(s.containers_ready_next_month)} ready, ${fmt(s.containers_in_process_following_month)} in process`}
        />
        <Tile
          label="Advance not yet covered"
          value={fmt(advance)}
          tone="ember"
          sub="After every open order and ready container has shipped"
        />
      </div>

      <div className="rulebox p-5 mb-8">
        <h3 className="text-base font-semibold mb-1">
          Polyco has funded production faster than shipping has allowed us to deliver
        </h3>
        <p className="text-sm text-ink-muted mb-5 max-w-3xl leading-relaxed">
          The shaded band is the difference between what Polyco has paid and what has been
          delivered against it. It widened through 2026 because payments continued while
          shipping conditions held goods in Bahrain.
        </p>

        <div className="h-[340px] -ml-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
              <defs>
                <pattern id="gapFill" width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
                  <rect width="6" height="6" fill="#F8EEE2" />
                  <line x1="0" y1="0" x2="0" y2="6" stroke="#C4762A" strokeWidth="1.2" opacity="0.55" />
                </pattern>
              </defs>
              <CartesianGrid stroke="#DDE3DF" vertical={false} />
              <XAxis
                dataKey="date" tickFormatter={monthLabel} minTickGap={48}
                tick={{ fill: '#5C6B64', fontSize: 11 }} stroke="#B8C2BC"
              />
              <YAxis
                tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} width={56}
                tick={{ fill: '#5C6B64', fontSize: 11 }} stroke="#B8C2BC"
              />
              <Tooltip
                labelFormatter={(v) => monthLabel(String(v))}
                formatter={(v: number, n: string) => [fmt(v), n]}
                contentStyle={{
                  border: '1px solid #DDE3DF', borderRadius: 0, fontSize: 12,
                  fontFamily: '"IBM Plex Mono", monospace',
                }}
              />
              <Area
                type="stepAfter" dataKey="receivedCumulative" name="Received"
                stroke="#2F5C27" strokeWidth={2} fill="url(#gapFill)" fillOpacity={1} isAnimationActive={false}
              />
              <Area
                type="stepAfter" dataKey="deliveredCumulative" name="Delivered"
                stroke="#C4762A" strokeWidth={2} fill="#FBFCFB" fillOpacity={1} isAnimationActive={false}
              />
              <ReferenceLine y={0} stroke="#B8C2BC" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-ink-muted">
          <span className="flex items-center gap-2">
            <span className="h-[2px] w-5 bg-leaf-deep inline-block" /> Received, cumulative
          </span>
          <span className="flex items-center gap-2">
            <span className="h-[2px] w-5 bg-ember inline-block" /> Delivered, cumulative
          </span>
          <span className="flex items-center gap-2">
            <span className="h-3 w-5 inline-block border border-ember/40 bg-ember-wash" /> Advance outstanding
          </span>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rulebox p-5">
          <h3 className="text-base font-semibold mb-3">How the advance is covered</h3>
          <table className="w-full text-sm">
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
          <p className="mt-4 text-xs text-ink-muted leading-relaxed">
            Cargo clearing and freight recharged to Polyco are already inside delivered value.
            They total {fmt(s.recharges_included_in_delivered)} and are shown here for information,
            not deducted a second time.
          </p>
        </div>

        <div className="rulebox p-5 flex flex-col gap-3">
          <h3 className="text-base font-semibold">What this means</h3>
          <Note>
            Open orders and finished containers cover {coverPct}% of the advance Polyco is holding
            with us. Delivering all of them leaves {fmt(advance)} still to be worked off in
            future production.
          </Note>
          <Note>
            An order delivered against this balance produces no payment, because it has already
            been paid for. Orders that bring in cash and orders that draw the balance down are
            two different things and are counted separately throughout.
          </Note>
          <Note tone="alert">
            Every figure above ties to the statement ledger at {asAt}. {ledger.rows.filter(r => r.flags.length).length} lines
            carry a date recorded inconsistently in the source workbook and are being confirmed
            before this statement is reissued.
          </Note>
        </div>
      </div>
    </section>
  )
}

function Row({
  label, value, rule, strong,
}: { label: string; value: number; rule?: boolean; strong?: boolean }) {
  return (
    <tr className={rule ? 'border-t border-rule' : undefined}>
      <td className={`py-1.5 pr-4 ${strong ? 'font-semibold' : ''}`}>{label}</td>
      <td className={`py-1.5 text-right num ${strong ? 'font-semibold' : ''}`}>
        {value < 0 ? `(${fmt(Math.abs(value))})` : fmt(value)}
      </td>
    </tr>
  )
}
