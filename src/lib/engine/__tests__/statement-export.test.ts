import { describe, expect, it } from 'vitest'
import ledgerRaw from '../../../../data/polyco-ledger.json'
import { Ledger } from '../../schema'
import { PRESETS, statementView } from '../statement'
import {
  buildExportSheet, exportFilename, exportHeader, toCsv, type ExportContext,
} from '../statement-export'

const ledger = Ledger.parse(ledgerRaw)

const context = (over: Partial<ExportContext> = {}): ExportContext => ({
  asAt: ledger.summary.as_at,
  from: null,
  to: null,
  exportedBy: 'izhar@ecofibre.bh',
  exportedAt: '2026-08-22T18:00:00.000Z',
  columns: PRESETS.reconciliation.columns,
  ...over,
})

const headerValue = (rows: [string, unknown][], label: string) =>
  String(rows.find(([l]) => l === label)?.[1] ?? '')

describe('the export header', () => {
  it('names both companies, the period, the balances and who exported it', () => {
    const view = statementView(ledger)
    const rows = exportHeader(view, context())

    expect(headerValue(rows, 'Between')).toContain('Eco Fibre Bahrain W.L.L.')
    expect(headerValue(rows, 'Between')).toContain('Polyco Healthline Ltd')
    expect(headerValue(rows, 'Ledger as at')).toBe(ledger.summary.as_at)
    expect(headerValue(rows, 'Opening balance')).toBe('0')
    expect(headerValue(rows, 'Closing balance')).toBe('2113292.74')
    expect(headerValue(rows, 'Exported by')).toBe('izhar@ecofibre.bh')
    expect(headerValue(rows, 'Exported at')).toBe('2026-08-22T18:00:00.000Z')
  })

  it('states the convention, so the column is not read backwards', () => {
    const rows = exportHeader(statementView(ledger), context())
    const convention = headerValue(rows, 'Convention')

    expect(convention).toMatch(/increase the balance/i)
    expect(convention).toMatch(/reduces it/i)
    expect(convention).toMatch(/yet to be delivered/i)
  })

  it('states the undated entries by count and net value, unfiltered', () => {
    const view = statementView(ledger)
    const line = headerValue(exportHeader(view, context()), 'Entries with no usable date')

    expect(line).toContain(String(view.undated.length))
    expect(line).toContain(view.undatedTotal.toFixed(2))
    expect(line).toMatch(/included in the closing balance/i)
  })

  it('warns that a filtered range excludes them, which is where a reconciliation goes wrong', () => {
    const range = { from: '2026-01-01', to: '2026-03-31' }
    const view = statementView(ledger, range)
    const line = headerValue(exportHeader(view, context(range)), 'Entries with no usable date')

    // A filtered range will not sum to the unfiltered closing. Say so in the file
    // rather than leaving Polyco's accounts team to find the difference.
    expect(view.undated.length).toBeGreaterThan(0)
    expect(line).toContain(String(view.undated.length))
    expect(line).toContain(view.undatedTotal.toFixed(2))
    expect(line).toMatch(/excluded from this range/i)
  })

  it('declares unconfirmed dates and near misses when there are any', () => {
    const range = { from: '2026-01-01', to: '2026-03-31' }
    const view = statementView(ledger, range)
    const rows = exportHeader(view, context(range))

    expect(headerValue(rows, 'Dates not yet confirmed')).toContain(String(view.unconfirmedDates))
    if (view.nearMisses.length > 0) {
      expect(headerValue(rows, 'Excluded on a corrected date')).toContain(
        String(view.nearMisses.length),
      )
    }
  })
})

describe('the sheet', () => {
  it('carries exactly the chosen columns, in the chosen order', () => {
    const view = statementView(ledger)
    const sheet = buildExportSheet(view, view.entries, context())

    expect(sheet.columnLabels).toEqual([
      'Date', 'Type', 'Reference', 'Received', 'Delivered value', 'Running balance',
    ])
    expect(sheet.rows[0]).toHaveLength(6)
  })

  it('exports figures as numbers, so a column sums', () => {
    const view = statementView(ledger)
    const sheet = buildExportSheet(view, view.entries, context())
    const balanceIndex = sheet.columnLabels.indexOf('Running balance')

    expect(sheet.numericColumns).toContain(balanceIndex)
    for (const row of sheet.rows.slice(0, 20)) {
      expect(typeof row[balanceIndex]).toBe('number')
    }
  })

  it('carries the flag in a column rather than stripping the row out', () => {
    const view = statementView(ledger)
    const sheet = buildExportSheet(view, view.entries, context({ columns: PRESETS.full.columns }))
    const flagIndex = sheet.columnLabels.indexOf('Flags')

    expect(flagIndex).toBeGreaterThan(-1)
    expect(sheet.rows.filter((r) => r[flagIndex] !== null).length).toBeGreaterThan(0)
  })

  it('has a row for every entry on screen and no more', () => {
    const view = statementView(ledger)
    const sheet = buildExportSheet(view, view.entries, context())
    expect(sheet.rows).toHaveLength(view.entries.length)
  })

  it('appends near misses below, labelled, and outside the totals', () => {
    const range = { from: '2026-01-01', to: '2026-03-31' }
    const view = statementView(ledger, range)
    const sheet = buildExportSheet(view, view.entries, context(range))

    expect(sheet.nearMissRows).toHaveLength(view.nearMisses.length)
    if (view.nearMisses.length > 0) {
      expect(sheet.nearMissLabel).toMatch(/not included in any total/i)
    }
  })
})

describe('the csv', () => {
  it('puts the header block above the rows, separated by a blank line', () => {
    const view = statementView(ledger)
    const csv = toCsv(buildExportSheet(view, view.entries, context()))
    const lines = csv.split('\r\n')

    expect(lines[0]).toContain('Statement of account')
    const blank = lines.indexOf('')
    expect(blank).toBeGreaterThan(0)
    expect(lines[blank + 1]).toBe('Date,Type,Reference,Received,Delivered value,Running balance')
  })

  it('quotes a field containing a comma, so the columns do not shift', () => {
    const view = statementView(ledger)
    const csv = toCsv(buildExportSheet(view, view.entries, context()))
    // The undated line reads "28 entries, net 50796.45, ..." and would otherwise
    // split across three columns.
    const undated = csv.split('\r\n').find((l) => l.startsWith('Entries with no usable date'))!

    expect(undated).toMatch(/^Entries with no usable date,"/)
    expect(undated.endsWith('"')).toBe(true)
  })

  it('doubles a quote inside a field, per RFC 4180', () => {
    const csv = toCsv({
      header: [['Note', 'He said "pay it" on Tuesday']],
      columnLabels: ['Reference'],
      rows: [['PO "2466124"'], ['line\nbreak']],
      numericColumns: [],
      nearMissLabel: null,
      nearMissRows: [],
    })

    expect(csv).toContain('"He said ""pay it"" on Tuesday"')
    expect(csv).toContain('"PO ""2466124"""')
    expect(csv).toContain('"line\nbreak"')
  })

  it('writes an empty cell rather than the word null', () => {
    const view = statementView(ledger)
    const csv = toCsv(buildExportSheet(view, view.entries, context({ columns: PRESETS.full.columns })))

    expect(csv).not.toContain('null')
    expect(csv).not.toContain('NaN')
  })
})

describe('the filename', () => {
  it('carries the range, as the spec sets out', () => {
    expect(exportFilename(context({ from: '2026-01-01', to: '2026-03-31' }), 'xlsx')).toBe(
      'ecofibre-polyco-statement-20260101-to-20260331.xlsx',
    )
  })

  it('says where an open-ended range starts and stops', () => {
    expect(exportFilename(context(), 'csv')).toBe(
      `ecofibre-polyco-statement-start-to-${ledger.summary.as_at.replace(/-/g, '')}.csv`,
    )
  })
})
