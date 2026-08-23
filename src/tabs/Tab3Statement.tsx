import { BookOpen } from 'lucide-react'
import { Fragment, useMemo, useState } from 'react'
import type { LedgerT } from '../lib/schema'
import { round2 } from '../lib/engine'
import {
  COLUMNS, PRESETS, balanceIsMeaningful, cellValue, entryTypeLabel, sortEntries,
  statementView, wholeDollars, type BalancedEntry, type StatementEntry,
} from '../lib/engine/statement'
import type { ExportContext } from '../lib/engine/statement-export'
import { downloadStatement } from '../lib/statement-download'
import {
  DATE_PRESETS, DEFAULT_STATE, readStatementUrl, resolvePreset, writeStatementUrl,
  type PresetKey, type StatementUrlState,
} from '../lib/statement-url'
import { money, moneyWhole, monthProse } from '../lib/format'
import { Card, CardBody, CardHead, Figures, Finding, Tile } from '../components/ui'

function dayLong(iso: string | null) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${+d} ${months[+m - 1]} ${y}`
}



export default function Tab3Statement({ ledger, who }: { ledger: LedgerT; who: string }) {
  const [state, setState] = useState<StatementUrlState>(() => {
    const fromUrl = readStatementUrl(window.location.search)
    // Nobody reconciles thirteen columns on a phone, but Andy will look at it on
    // one. A link that names its columns still wins. STATEMENT-SPEC section 6.
    const phone = typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches
    return phone && !window.location.search.includes('cols=')
      ? { ...fromUrl, columns: [...PRESETS.reconciliation.columns] }
      : fromUrl
  })

  const update = (next: Partial<StatementUrlState>) => {
    const merged = { ...state, ...next }
    setState(merged)
    // Replace rather than push: a reader changing a filter is refining one view,
    // not walking a history they will want to step back through.
    window.history.replaceState({}, '', `${window.location.pathname}${writeStatementUrl(merged)}`)
  }

  const view = useMemo(
    () => statementView(ledger, { from: state.from, to: state.to }),
    [ledger, state.from, state.to],
  )

  const showBalance = balanceIsMeaningful(state.sort)
  const columns = useMemo(
    () =>
      COLUMNS.filter(
        (c) => state.columns.includes(c.key) && (c.key !== 'balance' || showBalance),
      ),
    [state.columns, showBalance],
  )

  const rows = useMemo(
    () => sortEntries(view.entries, state.sort, state.direction),
    [view.entries, state.sort, state.direction],
  )

  /**
   * Rows grouped by month with a subtotal, section 6, so a reader finds a period
   * without reading every line. Undated entries keep their own group at the end,
   * which is where the engine already sorts them.
   */
  const monthGroups = useMemo(() => {
    const groups: { key: string; label: string; rows: typeof rows; received: number; delivered: number }[] = []
    for (const row of rows) {
      const key = row.date ? row.date.slice(0, 7) : 'undated'
      let group = groups[groups.length - 1]
      if (!group || group.key !== key) {
        group = {
          key,
          label: key === 'undated' ? 'No usable date' : monthProse(key),
          rows: [],
          received: 0,
          delivered: 0,
        }
        groups.push(group)
      }
      group.rows.push(row)
      group.received = round2(group.received + row.received)
      group.delivered = round2(group.delivered + row.delivered)
    }
    return groups
  }, [rows])

  const [busy, setBusy] = useState<'csv' | 'xlsx' | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)

  async function exportAs(format: 'csv' | 'xlsx') {
    setBusy(format)
    setExportError(null)

    const context: ExportContext = {
      asAt: ledger.summary.as_at,
      from: state.from,
      to: state.to,
      exportedBy: who,
      exportedAt: new Date().toISOString(),
      columns: columns.map((c) => c.key),
    }
    const result = await downloadStatement(view, rows, context, format)
    setBusy(null)
    if (!result.ok) setExportError(result.error)
  }

  const activePreset = Object.entries(PRESETS).find(
    ([, preset]) =>
      preset.columns.length === state.columns.length &&
      preset.columns.every((c) => state.columns.includes(c)),
  )?.[0]

  // Whole dollars that add up. See wholeDollars in the engine.
  const headline = wholeDollars(view)

  const finding =
    `The account stands at ${moneyWhole(headline.closing)} in Polyco's favour` +
    (view.filtered
      ? `, opening at ${moneyWhole(headline.opening)} and moving ${moneyWhole(headline.movement)} over the range shown.`
      : `, being ${moneyWhole(ledger.summary.total_received)} received against ${moneyWhole(ledger.summary.total_delivered)} delivered.`)

  return (
    <Card>
      <CardHead
        icon={<BookOpen size={20} className="text-leaf" aria-hidden />}
        kicker="Account"
        title="Statement"
        lede="Every transaction between the two companies, in date order. US dollars."
        asAt={`Ledger as at ${dayLong(ledger.summary.as_at)}`}
      />

      <CardBody flush>
      <div className="px-4 sm:px-6">
      <Finding>{finding}</Finding>

      <Figures>
        <Tile label="Opening balance" value={moneyWhole(headline.opening)} sub={state.from ? `Carried into ${dayLong(state.from)}` : 'Nothing before the first transaction'} />
        <Tile label="Movement in period" value={moneyWhole(headline.movement)} sub={`${rows.length} entries shown`} />
        <Tile label="Closing balance" value={moneyWhole(headline.closing)} sub="Receipts raise it, deliveries reduce it. Positive means value yet to deliver." tone="critical" />
      </Figures>

      {/* Controls in one bar, not scattered. Section 6. */}
      <div className="mt-6 border-t border-rule pt-4 no-print">
        <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
          <label className="flex flex-col gap-2">
            <span className="kicker">From</span>
            <input
              type="date"
              value={state.from ?? ''}
              onChange={(e) => update({ from: e.target.value || null })}
              className="field w-auto py-1.5"
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="kicker">To</span>
            <input
              type="date"
              value={state.to ?? ''}
              onChange={(e) => update({ to: e.target.value || null })}
              className="field w-auto py-1.5"
            />
          </label>

          <div className="flex flex-col gap-2">
            <span className="kicker">Period</span>
            <div className="flex flex-wrap gap-2">
              {DATE_PRESETS.map((preset) => (
                <button
                  key={preset.key}
                  type="button"
                  onClick={() => update(resolvePreset(preset.key as PresetKey, new Date()))}
                  className="btn-secondary"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="kicker">Columns</span>
            <div className="flex flex-wrap gap-2">
              {Object.entries(PRESETS).map(([key, preset]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => update({ columns: [...preset.columns] })}
                  className={`pill ${activePreset === key ? 'pill-active' : ''}`}
                >
                  {preset.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => update({ columns: [...DEFAULT_STATE.columns] })}
                className="btn-secondary"
              >
                Default
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2 ml-auto">
            <span className="kicker">Export</span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void exportAs('csv')}
                className="btn-secondary disabled:opacity-50"
              >
                {busy === 'csv' ? 'Working' : 'CSV'}
              </button>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void exportAs('xlsx')}
                className="btn-primary disabled:opacity-50"
              >
                {busy === 'xlsx' ? 'Working' : 'Excel'}
              </button>
            </div>
          </div>
        </div>

        <details className="mt-4 border-t border-rule pt-3">
          <summary className="cursor-pointer text-sub font-semibold text-leaf">
            Choose columns
          </summary>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
            {COLUMNS.map((column) => (
              <label key={column.key} className="flex items-center gap-1.5 text-table">
                <input
                  type="checkbox"
                  checked={state.columns.includes(column.key)}
                  disabled={column.locked}
                  onChange={(e) =>
                    update({
                      columns: e.target.checked
                        ? COLUMNS.filter(
                            (c) => state.columns.includes(c.key) || c.key === column.key,
                          ).map((c) => c.key)
                        : state.columns.filter((c) => c !== column.key),
                    })
                  }
                />
                <span className={column.locked ? 'text-ink-muted' : ''}>{column.label}</span>
              </label>
            ))}
          </div>
          <p className="lede mt-2">The running balance is always shown and cannot be removed.</p>
        </details>
      </div>

      {exportError && (
        <p role="alert" className="mt-4 rounded border-l-2 border-critical bg-critical-wash py-2 pl-3 pr-3 text-table text-ink">
          {exportError}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <p className="pill-summary">
          {rows.length} entries shown
          {view.filtered && `, ${dayLong(state.from) || 'the beginning'} to ${dayLong(state.to) || 'the latest entry'}`}
        </p>
        {view.unconfirmedDates > 0 && (
          <p className="pill-summary !bg-watch-wash !text-watch">
            {view.unconfirmedDates} carry a date not yet confirmed
          </p>
        )}
        {!showBalance && (
          <p className="pill-summary !bg-watch-wash !text-watch">
            Running balance hidden: it only means anything in date order
          </p>
        )}
      </div>
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[44rem] text-table">
          <thead className="sticky top-0 z-10">
            <tr className="text-left">
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={`th whitespace-nowrap ${column.numeric ? 'text-right' : ''}`}
                >
                  <button
                    type="button"
                    onClick={() =>
                      update({
                        sort: column.key,
                        direction:
                          state.sort === column.key && state.direction === 'asc' ? 'desc' : 'asc',
                      })
                    }
                    className="no-print hover:text-leaf"
                  >
                    {column.label}
                    {state.sort === column.key && (state.direction === 'asc' ? ' ▲' : ' ▼')}
                  </button>
                  <span className="hidden print:inline">{column.label}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {view.filtered && (
              <tr>
                <td
                  colSpan={columns.length}
                  className="border-b border-rule bg-tint px-3 py-2 font-bold text-ink-strong"
                >
                  Opening balance carried in
                  <span className="float-right num">{money(view.opening)}</span>
                </td>
              </tr>
            )}

            {monthGroups.map((group) => (
              <Fragment key={group.key}>
                <tr>
                  <td colSpan={columns.length} className="band-row">
                    {group.label}
                    <span className="ml-2 font-semibold normal-case tracking-normal opacity-70">
                      {group.rows.length} entries · received {money(group.received)} · delivered{' '}
                      {money(group.delivered)}
                    </span>
                  </td>
                </tr>
                {group.rows.map((entry) => (
                  <Row key={entry.id} entry={entry} columns={columns} showBalance={showBalance} />
                ))}
              </Fragment>
            ))}

            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-ink-muted">
                  No transactions fall in that range.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot className="sticky bottom-0 bg-surface">
            <tr className="border-t-2 border-rule bg-tint">
              <td colSpan={columns.length} className="px-3 py-3 font-bold text-ink-strong">
                Closing balance
                <span className="float-right num">{money(view.closing)}</span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Section 4. Never leave anyone guessing whether a row exists. */}
      {view.filtered && view.undated.length > 0 && (
        <Aside
          title={`${view.undated.length} entries have no usable date`}
          lede={`Net ${money(view.undatedTotal)}. They cannot be placed inside or outside a date range, so they are not in the balances above. They are included in the closing balance of the unfiltered statement.`}
          entries={view.undated}
          columns={columns}
        />
      )}

      {view.nearMisses.length > 0 && (
        <Aside
          title={`${view.nearMisses.length} entries excluded on a corrected date`}
          lede="These fall outside the range on the date recorded after correction, but inside it on the date the workbook originally carried. Shown so nothing goes missing. Not included in any total above."
          entries={view.nearMisses}
          columns={columns}
        />
      )}
      </CardBody>
    </Card>
  )
}

function Aside({
  title, lede, entries, columns,
}: {
  title: string
  lede: string
  entries: StatementEntry[]
  columns: typeof COLUMNS
}) {
  return (
    <div className="mt-6 border-t border-rule pt-5">
      <div className="px-4 pb-3 sm:px-6">
        <h3 className="text-figure font-bold text-leaf-deep">{title}</h3>
        <p className="lede mt-1 max-w-prose">{lede}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[44rem] text-table">
          <tbody>
            {entries.map((entry) => (
              <Row
                key={entry.id}
                entry={{ ...entry, balance: Number.NaN }}
                columns={columns}
                showBalance={false}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Row({
  entry, columns, showBalance,
}: {
  entry: BalancedEntry
  columns: typeof COLUMNS
  showBalance: boolean
}) {
  return (
    <tr className="border-b border-rule bg-surface align-top">
      {columns.map((column) => {
        const value = cellValue(entry, column.key)
        const isBalance = column.key === 'balance'

        return (
          <td
            key={column.key}
            className={`td ${column.numeric ? 'text-right num whitespace-nowrap' : ''}`}
          >
            {column.key === 'receivedDate' || column.key === 'deliveryDate' ? (
              <span className="whitespace-nowrap">
                {dayLong(entry.date) || <span className="text-ink-muted">No date</span>}
                {entry.dateUnconfirmed && (
                  <span className="ml-1.5 whitespace-nowrap rounded-full bg-watch-wash px-2 py-0.5 text-sub font-semibold text-watch">
                    was {dayLong(entry.originalDate) || 'unreadable'}
                  </span>
                )}
              </span>
            ) : column.key === 'type' ? (
              entryTypeLabel(entry)
            ) : isBalance ? (
              showBalance && !Number.isNaN(entry.balance) ? money(entry.balance) : ''
            ) : typeof value === 'number' ? (
              column.money ? money(round2(value)) : value
            ) : (
              (value ?? '')
            )}
          </td>
        )
      })}
    </tr>
  )
}
