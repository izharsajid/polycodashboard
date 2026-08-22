import { useMemo, useState } from 'react'
import type { LedgerT } from '../lib/schema'
import { fmt, round2 } from '../lib/engine'
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
import { Finding, SectionHead, Tile } from '../components/ui'

function dayLong(iso: string | null) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${+d} ${months[+m - 1]} ${y}`
}

/** Negatives in parentheses, consistent decimals down each column. Section 6. */
function money(value: number, dp = 2) {
  return value < 0 ? `(${fmt(Math.abs(value), dp)})` : fmt(value, dp)
}

export default function Tab3Statement({ ledger, who }: { ledger: LedgerT; who: string }) {
  const [state, setState] = useState<StatementUrlState>(() =>
    readStatementUrl(window.location.search),
  )

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
    `The account stands at ${money(headline.closing, 0)} in Polyco's favour` +
    (view.filtered
      ? `, opening at ${money(headline.opening, 0)} and moving ${money(headline.movement, 0)} over the range shown.`
      : `, being ${money(ledger.summary.total_received, 0)} received against ${money(ledger.summary.total_delivered, 0)} delivered.`)

  return (
    <section>
      <SectionHead
        kicker="Account"
        title="Statement"
        lede="Every transaction between the two companies, in date order, with a running balance. Export a range and reconcile it against your own ledger."
        asAt={`Ledger as at ${dayLong(ledger.summary.as_at)}`}
      />

      <Finding>{finding}</Finding>

      <p className="lede -mt-4 mb-7 max-w-3xl">
        Funds received from Polyco increase the balance. Delivered value reduces it. A positive
        balance means EcoFibre holds value yet to be delivered.
      </p>

      <div className="grid gap-card-gap sm:grid-cols-3">
        <Tile label="Opening balance" value={money(headline.opening, 0)} sub={state.from ? `Carried into ${dayLong(state.from)}` : 'Nothing before the first transaction'} />
        <Tile label="Movement in period" value={money(headline.movement, 0)} sub={`${rows.length} entries shown`} tone="leaf" />
        <Tile label="Closing balance" value={money(headline.closing, 0)} sub="Value EcoFibre holds yet to deliver" tone="alert" />
      </div>

      {/* Controls in one bar, not scattered. Section 6. */}
      <div className="card mt-card-gap no-print">
        <div className="px-card py-4 flex flex-wrap items-end gap-x-5 gap-y-3">
          <label className="flex flex-col gap-1">
            <span className="eyebrow">From</span>
            <input
              type="date"
              value={state.from ?? ''}
              onChange={(e) => update({ from: e.target.value || null })}
              className="rulebox rounded-field px-2 py-1.5 text-[13px]"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="eyebrow">To</span>
            <input
              type="date"
              value={state.to ?? ''}
              onChange={(e) => update({ to: e.target.value || null })}
              className="rulebox rounded-field px-2 py-1.5 text-[13px]"
            />
          </label>

          <div className="flex flex-col gap-1">
            <span className="eyebrow">Period</span>
            <div className="flex flex-wrap gap-1">
              {DATE_PRESETS.map((preset) => (
                <button
                  key={preset.key}
                  type="button"
                  onClick={() => update(resolvePreset(preset.key as PresetKey, new Date()))}
                  className="rounded-field border border-rule-field px-2 py-1.5 text-[13px] text-leaf-deep hover:bg-leaf-wash"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <span className="eyebrow">Columns</span>
            <div className="flex flex-wrap gap-1">
              {Object.entries(PRESETS).map(([key, preset]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => update({ columns: [...preset.columns] })}
                  className={`rounded-field border px-2 py-1.5 text-[13px] ${
                    activePreset === key
                      ? 'border-leaf bg-leaf-wash font-semibold text-leaf-deep'
                      : 'border-rule-field text-leaf-deep hover:bg-leaf-wash'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => update({ columns: [...DEFAULT_STATE.columns] })}
                className="rounded-field border border-rule-field px-2 py-1.5 text-[13px] text-leaf-deep hover:bg-leaf-wash"
              >
                Default
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1 ml-auto">
            <span className="eyebrow">Export</span>
            <div className="flex gap-1">
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void exportAs('csv')}
                className="rounded-field border border-rule-field px-3 py-1.5 text-[13px] font-extrabold text-leaf-deep hover:bg-leaf-wash disabled:opacity-50"
              >
                {busy === 'csv' ? 'Working' : 'CSV'}
              </button>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void exportAs('xlsx')}
                className="rounded-field bg-leaf-deep px-3 py-1.5 text-[13px] font-extrabold text-white hover:opacity-90 disabled:opacity-50"
              >
                {busy === 'xlsx' ? 'Working' : 'Excel'}
              </button>
            </div>
          </div>
        </div>

        <details className="border-t border-rule px-card py-3">
          <summary className="cursor-pointer text-[13px] font-bold text-leaf-deep">
            Choose columns
          </summary>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
            {COLUMNS.map((column) => (
              <label key={column.key} className="flex items-center gap-1.5 text-[13px]">
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
        <p role="alert" className="mt-3 border-l-2 border-alert pl-3 py-1 text-lede text-ink">
          {exportError}
        </p>
      )}

      <div className="mt-card-gap flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <p className="lede">
          {rows.length} entries shown
          {view.filtered && `, ${dayLong(state.from) || 'the beginning'} to ${dayLong(state.to) || 'the latest entry'}`}
        </p>
        {view.unconfirmedDates > 0 && (
          <p className="text-lede font-semibold text-state-watch">
            {view.unconfirmedDates} carry a date not yet confirmed
          </p>
        )}
        {!showBalance && (
          <p className="text-lede font-semibold text-state-watch">
            Running balance hidden: it only means anything in date order
          </p>
        )}
      </div>

      <div className="card mt-2 overflow-x-auto">
        <table className="w-full min-w-[44rem] text-table-cell">
          <thead className="sticky top-0 z-10">
            <tr className="text-left bg-paper-panel">
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={`border-b border-rule px-3 py-2.5 text-table-head font-extrabold uppercase text-ink-table whitespace-nowrap ${
                    column.numeric ? 'text-right' : ''
                  }`}
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
              <tr className="bg-paper-panel">
                <td
                  colSpan={columns.length}
                  className="border-b border-rule px-3 py-2 font-bold text-ink-strong"
                >
                  Opening balance carried in
                  <span className="float-right num">{money(view.opening)}</span>
                </td>
              </tr>
            )}

            {rows.map((entry) => (
              <Row key={entry.id} entry={entry} columns={columns} showBalance={showBalance} />
            ))}

            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-3 py-6 text-center text-ink-muted">
                  No transactions fall in that range.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="border-t border-rule-strong bg-paper-panel">
              <td colSpan={columns.length} className="px-3 py-2.5 font-bold text-ink-strong">
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
    </section>
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
    <div className="card mt-card-gap border-t-accent border-dashed border-ember">
      <div className="px-card pt-card pb-2">
        <h3 className="text-[15px] font-bold text-leaf-deep">{title}</h3>
        <p className="lede mt-1 max-w-3xl">{lede}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[44rem] text-table-cell">
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
    <tr className="border-b border-rule-soft align-top">
      {columns.map((column) => {
        const value = cellValue(entry, column.key)
        const isBalance = column.key === 'balance'

        return (
          <td
            key={column.key}
            className={`px-3 py-2 ${column.numeric ? 'text-right num whitespace-nowrap' : ''}`}
          >
            {column.key === 'date' ? (
              <span className="whitespace-nowrap">
                {dayLong(entry.date) || <span className="text-ink-muted">No date</span>}
                {entry.dateUnconfirmed && (
                  <span className="ml-1.5 whitespace-nowrap rounded-full bg-state-watch-wash px-1.5 py-[1px] text-[10px] font-extrabold text-state-watch">
                    was {dayLong(entry.originalDate) || 'unreadable'}
                  </span>
                )}
              </span>
            ) : column.key === 'type' ? (
              entryTypeLabel(entry)
            ) : isBalance ? (
              showBalance && !Number.isNaN(entry.balance) ? money(entry.balance) : ''
            ) : typeof value === 'number' ? (
              money(round2(value))
            ) : (
              (value ?? '')
            )}
          </td>
        )
      })}
    </tr>
  )
}
